import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSessionToken,
  signPendingMfaToken,
  signSession,
  type MfaMethod,
  type PendingMfaPayload,
  type SessionPayload,
} from "@/lib/auth/session";
import { consumeVerifiedCaptchaToken } from "@/lib/auth/captcha";
import { touchSessionActivity, verifyRepositoryActor } from "@/lib/auth/rbac";
import { enforceSystemMode } from "@/lib/auth/system-mode";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { maybeEncryptPii } from "@/lib/crypto/fernet";
import {
  notifyAdminsNewRegistration,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendPinResetEmail,
} from "@/lib/email";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  LockedError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  DROPBOX_FOLDERS,
  detectImageSignature,
  stripImageMetadata,
} from "@/lib/storage";
import {
  deleteFromDropbox,
  isDropboxConfigured,
  uploadToDropbox,
} from "@/lib/storage/dropbox";
import { resolveEmail } from "@/repositories/shared";
import {
  clearExpiredOtpRows,
  closeAllUserLoginSessions,
  closeLoginSessionRow,
  findActiveAdminEmails,
  findUserByEmail,
  findUserById,
  findUserByPasswordResetToken,
  findUserByPinResetToken,
  insertNewUserAccount,
  insertRegistrationRequest,
  isEmailRegistered,
  recordLoginSessionRow,
  updateUserAuthFields,
  type AuthUserRow,
} from "@/repositories/auth.repository";
import type {
  LoginInput,
  ResetPasswordInput,
  ResetPinInput,
  SignupInput,
} from "@/validators/auth";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const PIN_RESET_TTL_MS = 30 * 60 * 1000;
const PIN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_VALID_ID_BYTES = 2 * 1024 * 1024;
const OTP_CLEANUP_COOLDOWN_MS = 60_000;

let lastOtpCleanupAt = 0;
let otpCleanupInFlight = false;

export function maybeCleanupExpiredOtps(supabase: SupabaseClient): void {
  const now = Date.now();
  if (otpCleanupInFlight || now - lastOtpCleanupAt < OTP_CLEANUP_COOLDOWN_MS) {
    return;
  }
  lastOtpCleanupAt = now;
  otpCleanupInFlight = true;
  void clearExpiredOtpRows(supabase, new Date(now).toISOString())
    .catch((err) => {
      logger.warn("Lazy expired-OTP cleanup failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    })
    .finally(() => {
      otpCleanupInFlight = false;
    });
}

function detectValidIdFileType(bytes: Uint8Array): {
  ext: ".jpg" | ".png" | ".webp" | ".pdf";
  mime: string;
  imageSig: "jpeg" | "png" | "webp" | null;
} | null {
  const imgSig = detectImageSignature(bytes);
  if (imgSig === "jpeg") {
    return { ext: ".jpg", mime: "image/jpeg", imageSig: "jpeg" };
  }
  if (imgSig === "png") {
    return { ext: ".png", mime: "image/png", imageSig: "png" };
  }
  if (imgSig === "webp") {
    return { ext: ".webp", mime: "image/webp", imageSig: "webp" };
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return { ext: ".pdf", mime: "application/pdf", imageSig: null };
  }
  return null;
}

async function uploadSignupValidId(file: File): Promise<string> {
  if (file.size > MAX_VALID_ID_BYTES) {
    throw new ValidationError("Valid ID file must be 2 MB or smaller.");
  }

  const arrayBuf = await file.arrayBuffer();
  let bytes: Uint8Array = new Uint8Array(arrayBuf);
  if (bytes.byteLength === 0) {
    throw new ValidationError("Uploaded valid ID file is empty.");
  }
  if (bytes.byteLength > MAX_VALID_ID_BYTES) {
    throw new ValidationError("Valid ID file must be 2 MB or smaller.");
  }

  const detected = detectValidIdFileType(bytes);
  if (!detected) {
    throw new ValidationError(
      "Unsupported valid ID file type. Upload a genuine JPEG, PNG, WebP, or PDF file."
    );
  }

  const claimedMime = (file.type || "").trim().toLowerCase();
  if (claimedMime && claimedMime !== "application/octet-stream") {
    const normalizedClaimed = claimedMime === "image/jpg" ? "image/jpeg" : claimedMime;
    if (normalizedClaimed !== detected.mime) {
      throw new ValidationError(
        "Valid ID file content does not match its declared MIME type."
      );
    }
  }

  if (detected.imageSig) {
    bytes = stripImageMetadata(bytes, detected.imageSig);
  }

  if (!isDropboxConfigured()) {
    throw new AppError(
      "Valid ID upload is temporarily unavailable because Dropbox storage is not configured.",
      503,
      "STORAGE_UNAVAILABLE"
    );
  }

  const safeFilename = `${crypto.randomBytes(16).toString("hex")}${detected.ext}`;
  const baseDir = DROPBOX_FOLDERS["valid-ids"]().replace(/\/+$/, "");
  const dropboxPath = `${baseDir}/${safeFilename}`;

  await uploadToDropbox(dropboxPath, bytes);
  return dropboxPath;
}

function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf-8").digest("hex");
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a, "utf-8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf-8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function getRoleRedirectUrl(role: "admin" | "librarian" | "user"): string {
  return role === "admin"
    ? "/dashboard"
    : role === "librarian"
      ? "/librarian/dashboard"
      : "/user/home";
}

function isAccountCurrentlyLocked(user: AuthUserRow): boolean {
  if (!user.is_locked) return false;
  if (!user.lock_until) return true;
  const lockUntilMs = new Date(user.lock_until).getTime();
  return !Number.isFinite(lockUntilMs) || lockUntilMs > Date.now();
}

async function finishAuthenticatedLogin(
  supabase: SupabaseClient,
  user: AuthUserRow,
  route: string,
  fallbackEmail?: string
): Promise<{
  role: "admin" | "librarian" | "user";
  redirectTo: string;
  signedCookie: string;
  resolvedEmail: string;
}> {
  await enforceSystemMode(supabase, user.role);

  const nowIso = new Date().toISOString();
  const sessionToken = createSessionToken();
  const resolvedEmail =
    resolveEmail(user.email_display, user.username) || fallbackEmail || "";

  await Promise.all([
    updateUserAuthFields(supabase, user.id, {
      failed_attempts: 0,
      is_locked: false,
      lock_until: null,
      status: "active",
      last_seen: nowIso,
    }),
    recordLoginSessionRow(supabase, user.id, sessionToken, nowIso),
  ]);

  await recordAuditEvent(
    {
      action: "login",
      resource: "login_sessions",
      actorId: user.id,
      targetId: user.id,
      actorRole: user.role,
      route,
      method: "POST",
    },
    supabase
  );

  const redirectTo = getRoleRedirectUrl(user.role);
  const signedCookie = signSession({
    userId: user.id,
    role: user.role,
    email: resolvedEmail,
    sessionToken,
  });

  return {
    role: user.role,
    redirectTo,
    signedCookie,
    resolvedEmail,
  };
}

async function handleExpiredPinDuringMfa(
  supabase: SupabaseClient,
  user: AuthUserRow,
  requestOrigin: string,
  route: string
): Promise<never> {
  if (!user.is_active || !user.is_approved) {
    throw new UnauthorizedError(
      "MFA verification session is invalid or expired. Please sign in again."
    );
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiryIso = new Date(Date.now() + PIN_RESET_TTL_MS).toISOString();

  await updateUserAuthFields(supabase, user.id, {
    pin_reset_token: tokenHash,
    pin_reset_token_expiry: expiryIso,
  });

  const deliveryEmail = resolveEmail(user.email_display, user.username);
  if (deliveryEmail.includes("@")) {
    const resetUrl = `${requestOrigin}/reset-pin?token=${encodeURIComponent(rawToken)}`;
    await sendPinResetEmail(deliveryEmail, resetUrl);
  }

  await recordAuditEvent(
    {
      action: "request_pin_reset_expired",
      resource: "users",
      actorId: user.id,
      targetId: user.id,
      actorRole: String(user.role || "user"),
      route,
      method: "POST",
    },
    supabase
  );

  throw new AppError(
    "Your security PIN has expired (older than 7 days). A PIN reset link has been sent to your email.",
    400,
    "PIN_EXPIRED",
    { clearPendingMfa: true }
  );
}

export type LoginServiceResult =
  | {
      ok: true;
      mfa_required: true;
      methods: MfaMethod[];
      pendingMfaCookie: string;
    }
  | {
      ok: true;
      mfa_required: false;
      redirectTo: string;
      signedCookie: string;
      user: { id: number; role: "admin" | "librarian" | "user"; email: string };
    };

export async function authenticateUserLogin(
  supabase: SupabaseClient,
  input: LoginInput,
  clientIp: string
): Promise<LoginServiceResult> {
  maybeCleanupExpiredOtps(supabase);
  const email = input.email.trim().toLowerCase();

  await enforceRateLimit(
    {
      scope: "auth:login",
      identifier: `${clientIp}:${email}`,
      maxAttempts: 15,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  // Per legacy-flask/authentication/authentication.py, CAPTCHA is required on every login.
  const captchaCheck = consumeVerifiedCaptchaToken(input.captcha_token);
  if (!captchaCheck.valid) {
    throw new ValidationError(
      captchaCheck.reason || "Invalid or expired CAPTCHA verification. Please try again."
    );
  }

  const user = await findUserByEmail(supabase, email);
  if (!user) {
    await recordErrorLog(
      {
        level: "warning",
        source: "Auth",
        route: "/api/auth/login",
        method: "POST",
        status_code: 401,
        message: "Failed login attempt for unknown account",
        user_email: "unknown",
      },
      supabase
    );
    throw new UnauthorizedError("Invalid email or password.");
  }

  if (!user.is_active) {
    await recordErrorLog(
      {
        level: "security",
        source: "Auth",
        route: "/api/auth/login",
        method: "POST",
        status_code: 403,
        message: `Blocked sign-in to deactivated account #${user.id}`,
        user_email: `user#${user.id}`,
      },
      supabase
    );
    throw new ForbiddenError("This account has been deactivated. Contact library staff.");
  }

  if (!user.is_approved) {
    await recordErrorLog(
      {
        level: "warning",
        source: "Auth",
        route: "/api/auth/login",
        method: "POST",
        status_code: 403,
        message: `Sign-in attempted while pending approval (User #${user.id})`,
        user_email: `user#${user.id}`,
      },
      supabase
    );
    throw new AppError(
      "Your account is still pending administrator approval.",
      403,
      "PENDING_APPROVAL",
      { pendingApproval: true }
    );
  }

  // Check active lockout (rejects both timed locks and indefinite locks where lock_until is null)
  if (user.is_locked) {
    if (isAccountCurrentlyLocked(user)) {
      throw new LockedError(
        "Account temporarily locked due to multiple failed attempts. Try again later."
      );
    }
    await updateUserAuthFields(supabase, user.id, {
      is_locked: false,
      failed_attempts: 0,
      lock_until: null,
    });
    user.failed_attempts = 0;
  }

  const validPassword = await bcrypt.compare(input.password, user.password);
  if (!validPassword) {
    const nextAttempts = (user.failed_attempts ?? 0) + 1;
    if (nextAttempts >= LOCKOUT_THRESHOLD) {
      const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
      await updateUserAuthFields(supabase, user.id, {
        failed_attempts: nextAttempts,
        is_locked: true,
        lock_until: lockUntil,
      });
      await recordErrorLog(
        {
          level: "security",
          source: "Auth",
          route: "/api/auth/login",
          method: "POST",
          status_code: 423,
          message: `Account #${user.id} locked after ${nextAttempts} failed login attempts`,
          details: `Locked until ${lockUntil}`,
          user_email: `user#${user.id}`,
        },
        supabase
      );
      throw new LockedError(
        "Too many failed attempts. Account locked for 15 minutes."
      );
    }

    await updateUserAuthFields(supabase, user.id, {
      failed_attempts: nextAttempts,
    });
    await recordErrorLog(
      {
        level: "warning",
        source: "Auth",
        route: "/api/auth/login",
        method: "POST",
        status_code: 401,
        message: `Invalid password attempt (${nextAttempts}/${LOCKOUT_THRESHOLD}) for User #${user.id}`,
        user_email: `user#${user.id}`,
      },
      supabase
    );
    throw new UnauthorizedError("Invalid email or password.");
  }

  // Enforce emergency lockdown & maintenance mode before issuing MFA challenge or session (admins always pass)
  await enforceSystemMode(supabase, user.role);

  // If MFA (OTP and/or PIN) is enabled, issue a pending-MFA challenge cookie instead of a full session
  if (user.otp_enabled || user.pin_enabled) {
    const methods: MfaMethod[] = [
      ...(user.otp_enabled ? (["otp"] as const) : []),
      ...(user.pin_enabled ? (["pin"] as const) : []),
    ];
    const step = methods[0];
    const resolvedEmail = resolveEmail(user.email_display, user.username) || email;

    if (step === "otp") {
      const otp = generateOtpCode();
      const hashedOtp = await bcrypt.hash(otp, 10);
      const expiryIso = new Date(Date.now() + OTP_TTL_MS).toISOString();

      await updateUserAuthFields(supabase, user.id, {
        otp_code: hashedOtp,
        otp_expiry: expiryIso,
      });

      if (resolvedEmail.includes("@")) {
        await sendOtpEmail(resolvedEmail, otp);
      }
    }

    const pendingMfaCookie = signPendingMfaToken({
      uid: user.id,
      step,
      methods,
    });

    return {
      ok: true,
      mfa_required: true,
      methods,
      pendingMfaCookie,
    };
  }

  const finished = await finishAuthenticatedLogin(
    supabase,
    user,
    "/api/auth/login",
    email
  );

  return {
    ok: true,
    mfa_required: false,
    redirectTo: finished.redirectTo,
    signedCookie: finished.signedCookie,
    user: {
      id: user.id,
      role: finished.role,
      email: finished.resolvedEmail,
    },
  };
}

export async function getActiveSessionStatus(
  session: SessionPayload | null,
  supabase?: SupabaseClient | null
): Promise<{
  authenticated: boolean;
  user: { id: number; role: "admin" | "librarian" | "user"; email: string } | null;
}> {
  if (!session) {
    return { authenticated: false, user: null };
  }

  if (supabase) {
    try {
      const dbUser = await findUserById(supabase, session.userId);
      if (!dbUser || !dbUser.is_active || !dbUser.is_approved) {
        return { authenticated: false, user: null };
      }

      const isCurrentlyLocked =
        Boolean(dbUser.is_locked) &&
        (!dbUser.lock_until || Date.parse(String(dbUser.lock_until)) > Date.now());
      if (isCurrentlyLocked) {
        return { authenticated: false, user: null };
      }

      if (session.sessionToken) {
        const { data: sessionRows, error: sessionError } = await supabase
          .from("login_sessions")
          .select("id, logout_at")
          .eq("user_id", session.userId)
          .eq("session_token", session.sessionToken)
          .limit(1);

        if (sessionError) {
          return { authenticated: false, user: null };
        }
        const activeRow = Array.isArray(sessionRows) ? sessionRows[0] : null;
        if (!activeRow || activeRow.logout_at !== null) {
          return { authenticated: false, user: null };
        }
      }

      // Enforce emergency lockdown & maintenance mode (admins always pass)
      await enforceSystemMode(supabase, dbUser.role);

      await touchSessionActivity(session, supabase);

      return {
        authenticated: true,
        user: {
          id: dbUser.id,
          role: dbUser.role,
          email: resolveEmail(dbUser.email_display, dbUser.username) || session.email,
        },
      };
    } catch {
      // Fail closed on DB errors or system mode blocks
      return { authenticated: false, user: null };
    }
  }

  return {
    authenticated: true,
    user: {
      id: session.userId,
      role: session.role,
      email: session.email,
    },
  };
}

export async function logoutUserSession(
  supabase: SupabaseClient,
  session: SessionPayload
): Promise<void> {
  const nowIso = new Date().toISOString();
  await closeLoginSessionRow(supabase, session.userId, session.sessionToken, nowIso);
  await recordAuditEvent(
    {
      action: "logout",
      resource: "login_sessions",
      actorId: session.userId,
      targetId: session.userId,
      actorRole: session.role,
      route: "/logout",
      method: "GET",
    },
    supabase
  );
}

export async function checkEmailAvailabilityService(
  supabase: SupabaseClient,
  email: string
): Promise<{ available: boolean; taken: boolean; reason: string }> {
  const taken = await isEmailRegistered(supabase, email);
  return {
    available: !taken,
    taken,
    reason: taken ? "This email is already registered." : "Email is available.",
  };
}

export async function registerUserAccountService(
  supabase: SupabaseClient,
  input: SignupInput,
  actorSession: SessionPayload | null,
  clientIp: string,
  validIdFile: File | null = null
): Promise<{
  ok: true;
  id: number;
  role: "user" | "librarian" | "admin";
  message: string;
  isStaffCreation: boolean;
}> {
  const requestedRole = input.role ?? "user";
  const isStaffCreation = requestedRole === "admin" || requestedRole === "librarian";

  if (isStaffCreation) {
    if (!actorSession) {
      throw new UnauthorizedError("Unauthorized: Only admins can create staff accounts.");
    }
    if (actorSession.role !== "admin") {
      throw new ForbiddenError("Forbidden: Only admins can create staff accounts.");
    }
    await verifyRepositoryActor(
      supabase,
      actorSession.userId,
      ["admin"],
      actorSession.sessionToken
    );
  } else {
    await enforceRateLimit(
      {
        scope: "auth:signup",
        identifier: clientIp,
        maxAttempts: 10,
        windowSeconds: 600,
        blockSeconds: 600,
      },
      supabase
    );
  }

  const email = input.email.trim().toLowerCase();
  const alreadyExists = await isEmailRegistered(supabase, email);
  if (alreadyExists) {
    throw new ConflictError("An account with this email already exists.");
  }

  let uploadedValidIdPath: string | null = null;
  if (!isStaffCreation && validIdFile) {
    uploadedValidIdPath = await uploadSignupValidId(validIdFile);
  }

  const hashedPassword = await bcrypt.hash(input.password, 12);
  const ageStr =
    input.age !== undefined && input.age !== null ? String(input.age).trim() : "";
  const phoneStr = (input.phone || input.phone_number || "").trim();
  const isGovernment =
    input.is_government === true ||
    input.is_government === "true" ||
    input.is_government === "1" ||
    input.is_government === 1;
  const officePhone = (input.office_phone ?? "").trim();
  const validIdName = (input.valid_id_name ?? "").trim().slice(0, 480);
  const storedValidIdRef = uploadedValidIdPath || validIdName || null;

  let inserted: { id: number };
  try {
    inserted = await insertNewUserAccount(supabase, {
      username: email,
      email_display: email,
      firstname: input.firstname.trim(),
      lastname: input.lastname.trim(),
      password: hashedPassword,
      role: requestedRole,
      age: ageStr || null,
      gender: input.gender?.trim() || null,
      phone_number: phoneStr || null,
      school: input.school?.trim() || null,
      city: input.city?.trim() || null,
      province: input.province?.trim() || null,
      education_level: input.education_level?.trim() || null,
      occupation: input.occupation?.trim() || null,
      is_government: isGovernment,
      office_phone: isGovernment && officePhone ? officePhone : null,
      valid_id_path: storedValidIdRef ? maybeEncryptPii(storedValidIdRef) : null,
      is_active: isStaffCreation,
      is_approved: isStaffCreation,
      status: "offline",
    });

    if (!isStaffCreation) {
      await insertRegistrationRequest(supabase, inserted.id, email);
    }
  } catch (err) {
    if (uploadedValidIdPath) {
      void deleteFromDropbox(uploadedValidIdPath).catch(() => {});
    }
    throw err;
  }

  if (!isStaffCreation) {
    void findActiveAdminEmails(supabase)
      .then((adminEmails) =>
        notifyAdminsNewRegistration({
          adminEmails,
          firstname: input.firstname.trim(),
          lastname: input.lastname.trim(),
          applicantEmail: email,
        })
      )
      .catch((err) => {
        logger.error("Failed to send new registration admin notification", {
          userId: inserted.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  await recordAuditEvent(
    {
      action: isStaffCreation ? `create_${requestedRole}` : "register_user",
      resource: "users",
      actorId: actorSession?.userId ?? inserted.id,
      targetId: inserted.id,
      actorRole: actorSession?.role ?? "user",
      route: "/api/auth/signup",
      method: "POST",
    },
    supabase
  );

  return {
    ok: true,
    id: inserted.id,
    role: requestedRole,
    isStaffCreation,
    message: isStaffCreation
      ? `${requestedRole.charAt(0).toUpperCase() + requestedRole.slice(1)} account created and activated.`
      : "Registration submitted! Your account is now awaiting administrator approval.",
  };
}

export async function resendOtpService(
  supabase: SupabaseClient,
  pendingMfa: PendingMfaPayload,
  clientIp: string
): Promise<{ ok: true; message: string }> {
  maybeCleanupExpiredOtps(supabase);
  await enforceRateLimit(
    {
      scope: "auth:resend-otp",
      identifier: `${clientIp}:${pendingMfa.uid}`,
      maxAttempts: 5,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  if (pendingMfa.step !== "otp") {
    throw new ValidationError("OTP verification is not active for this session.");
  }

  const user = await findUserById(supabase, pendingMfa.uid);
  if (!user || !user.is_active || !user.is_approved || isAccountCurrentlyLocked(user)) {
    throw new UnauthorizedError(
      "MFA verification session is invalid or expired. Please sign in again."
    );
  }

  const otp = generateOtpCode();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const expiryIso = new Date(Date.now() + OTP_TTL_MS).toISOString();

  await updateUserAuthFields(supabase, user.id, {
    otp_code: hashedOtp,
    otp_expiry: expiryIso,
  });

  const deliveryEmail = resolveEmail(user.email_display, user.username);
  if (deliveryEmail.includes("@")) {
    await sendOtpEmail(deliveryEmail, otp);
  }

  await recordAuditEvent(
    {
      action: "resend_otp",
      resource: "users",
      actorId: user.id,
      targetId: user.id,
      actorRole: String(user.role || "user"),
      route: "/api/auth/resend-otp",
      method: "POST",
    },
    supabase
  );

  return {
    ok: true,
    message: "A new 6-digit verification code has been sent to your email.",
  };
}

export type VerifyOtpResult =
  | {
      ok: true;
      verified: true;
      mfa_required: true;
      methods: ["pin"];
      pendingMfaCookie: string;
    }
  | {
      ok: true;
      verified: true;
      mfa_required: false;
      role: "admin" | "librarian" | "user";
      redirectUrl: string;
      signedCookie: string;
    };

export async function verifyOtpService(
  supabase: SupabaseClient,
  pendingMfa: PendingMfaPayload,
  input: { otp: string },
  requestOrigin: string,
  clientIp: string
): Promise<VerifyOtpResult> {
  maybeCleanupExpiredOtps(supabase);
  await enforceRateLimit(
    {
      scope: "auth:verify-otp",
      identifier: `${clientIp}:${pendingMfa.uid}`,
      maxAttempts: 10,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  if (pendingMfa.step !== "otp") {
    throw new ValidationError("Invalid verification step for this session.");
  }

  const user = await findUserById(supabase, pendingMfa.uid);
  if (!user || !user.is_active || !user.is_approved || isAccountCurrentlyLocked(user)) {
    throw new UnauthorizedError(
      "MFA verification session is invalid or expired. Please sign in again."
    );
  }

  if (!user.otp_code || !user.otp_expiry) {
    throw new ValidationError(
      "No active verification code found. Please request a new OTP."
    );
  }

  const expiryMs = Date.parse(String(user.otp_expiry));
  if (Number.isNaN(expiryMs) || expiryMs < Date.now()) {
    await updateUserAuthFields(supabase, user.id, {
      otp_code: null,
      otp_expiry: null,
    });
    throw new ValidationError(
      "Verification code has expired. Please request a new OTP."
    );
  }

  const storedOtp = String(user.otp_code);
  const candidateOtp = input.otp.trim().toUpperCase();
  const isValid = storedOtp.startsWith("$2")
    ? await bcrypt.compare(candidateOtp, storedOtp)
    : constantTimeStringEqual(storedOtp.toUpperCase(), candidateOtp);

  if (!isValid) {
    throw new ValidationError("Invalid verification code. Please try again.");
  }

  await updateUserAuthFields(supabase, user.id, {
    otp_code: null,
    otp_expiry: null,
  });

  await recordAuditEvent(
    {
      action: "verify_otp",
      resource: "users",
      actorId: user.id,
      targetId: user.id,
      actorRole: String(user.role || "user"),
      route: "/api/auth/verify-otp",
      method: "POST",
    },
    supabase
  );

  const needsPin = pendingMfa.methods.includes("pin") || Boolean(user.pin_enabled);
  if (needsPin) {
    const pinSetMs = user.pin_set_at ? Date.parse(String(user.pin_set_at)) : NaN;
    if (!user.pin_code || !Number.isFinite(pinSetMs) || Date.now() - pinSetMs > PIN_EXPIRY_MS) {
      await handleExpiredPinDuringMfa(supabase, user, requestOrigin, "/api/auth/verify-otp");
    }

    const nextPendingMfaCookie = signPendingMfaToken({
      uid: user.id,
      step: "pin",
      methods: ["pin"],
    });

    return {
      ok: true,
      verified: true,
      mfa_required: true,
      methods: ["pin"],
      pendingMfaCookie: nextPendingMfaCookie,
    };
  }

  const finished = await finishAuthenticatedLogin(
    supabase,
    user,
    "/api/auth/verify-otp"
  );

  return {
    ok: true,
    verified: true,
    mfa_required: false,
    role: finished.role,
    redirectUrl: finished.redirectTo,
    signedCookie: finished.signedCookie,
  };
}

export async function verifyPinService(
  supabase: SupabaseClient,
  pendingMfa: PendingMfaPayload,
  input: { pin: string },
  requestOrigin: string,
  clientIp: string
): Promise<{
  ok: true;
  verified: true;
  role: "admin" | "librarian" | "user";
  redirectUrl: string;
  signedCookie: string;
}> {
  await enforceRateLimit(
    {
      scope: "auth:verify-pin",
      identifier: `${clientIp}:${pendingMfa.uid}`,
      maxAttempts: 10,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  if (pendingMfa.step !== "pin") {
    throw new ValidationError("Invalid verification step for this session.");
  }

  const user = await findUserById(supabase, pendingMfa.uid);
  if (!user || !user.is_active || !user.is_approved || isAccountCurrentlyLocked(user)) {
    throw new UnauthorizedError(
      "MFA verification session is invalid or expired. Please sign in again."
    );
  }

  if (!user.pin_enabled || !user.pin_code) {
    throw new ValidationError("Security PIN is not configured for this account.");
  }

  const pinSetMs = user.pin_set_at ? Date.parse(String(user.pin_set_at)) : NaN;
  if (!Number.isFinite(pinSetMs) || Date.now() - pinSetMs > PIN_EXPIRY_MS) {
    await handleExpiredPinDuringMfa(supabase, user, requestOrigin, "/api/auth/verify-pin");
  }

  const storedPin = String(user.pin_code);
  const isValid = storedPin.startsWith("$2")
    ? await bcrypt.compare(input.pin, storedPin)
    : constantTimeStringEqual(storedPin, input.pin);

  if (!isValid) {
    throw new ValidationError("Incorrect security PIN. Please try again.");
  }

  await recordAuditEvent(
    {
      action: "verify_pin",
      resource: "users",
      actorId: user.id,
      targetId: user.id,
      actorRole: String(user.role || "user"),
      route: "/api/auth/verify-pin",
      method: "POST",
    },
    supabase
  );

  const finished = await finishAuthenticatedLogin(
    supabase,
    user,
    "/api/auth/verify-pin"
  );

  return {
    ok: true,
    verified: true,
    role: finished.role,
    redirectUrl: finished.redirectTo,
    signedCookie: finished.signedCookie,
  };
}

export async function processPasswordResetService(
  supabase: SupabaseClient,
  input: ResetPasswordInput,
  requestOrigin: string,
  clientIp: string
): Promise<{ ok: true; message: string }> {
  if (input.action === "request") {
    const email = input.email.trim().toLowerCase();

    await enforceRateLimit(
      {
        scope: "auth:reset-password:request",
        identifier: `${clientIp}:${email}`,
        maxAttempts: 8,
        windowSeconds: 300,
        blockSeconds: 300,
      },
      supabase
    );

    const user = await findUserByEmail(supabase, email);

    if (user && user.is_active && user.is_approved) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashResetToken(rawToken);
      const expiryIso = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

      await updateUserAuthFields(supabase, user.id, {
        reset_token: tokenHash,
        reset_token_expiry: expiryIso,
      });

      const resetUrl = `${requestOrigin}/reset-password?token=${encodeURIComponent(rawToken)}`;
      await sendPasswordResetEmail(email, resetUrl);

      await recordAuditEvent(
        {
          action: "request_password_reset",
          resource: "users",
          actorId: user.id,
          targetId: user.id,
          actorRole: String(user.role || "user"),
          route: "/api/auth/reset-password",
          method: "POST",
        },
        supabase
      );
    }

    return {
      ok: true,
      message:
        "If an active account exists for that email, a password reset link has been sent.",
    };
  }

  await enforceRateLimit(
    {
      scope: "auth:reset-password:confirm",
      identifier: clientIp,
      maxAttempts: 8,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  const { token, new_password } = input;
  const tokenHash = hashResetToken(token);
  const user = await findUserByPasswordResetToken(supabase, tokenHash);
  if (!user || !user.reset_token || !constantTimeStringEqual(String(user.reset_token), tokenHash)) {
    throw new ValidationError(
      "Invalid or expired reset link. Please request a new one."
    );
  }

  if (!user.is_active || !user.is_approved) {
    throw new ForbiddenError(
      "This account is inactive or pending approval. Contact library staff."
    );
  }

  const expiryMs = user.reset_token_expiry
    ? Date.parse(String(user.reset_token_expiry))
    : 0;
  if (!expiryMs || expiryMs < Date.now()) {
    await updateUserAuthFields(supabase, user.id, {
      reset_token: null,
      reset_token_expiry: null,
    });
    throw new ValidationError(
      "This reset link has expired. Please request a new one."
    );
  }

  if (user.password && (await bcrypt.compare(new_password, user.password))) {
    throw new ValidationError(
      "New password must be different from your current password."
    );
  }

  const hashedPassword = await bcrypt.hash(new_password, 12);
  const nowIso = new Date().toISOString();

  await Promise.all([
    updateUserAuthFields(supabase, user.id, {
      password: hashedPassword,
      reset_token: null,
      reset_token_expiry: null,
      is_locked: false,
      failed_attempts: 0,
      lock_until: null,
    }),
    closeAllUserLoginSessions(supabase, user.id, nowIso),
  ]);

  await recordAuditEvent(
    {
      action: "confirm_password_reset",
      resource: "users",
      actorId: user.id,
      targetId: user.id,
      actorRole: String(user.role || "user"),
      route: "/api/auth/reset-password",
      method: "POST",
    },
    supabase
  );

  return {
    ok: true,
    message: "Your password has been updated. You can now sign in.",
  };
}

export async function processPinResetService(
  supabase: SupabaseClient,
  input: ResetPinInput,
  requestOrigin: string,
  clientIp: string
): Promise<{ ok: true; message: string }> {
  if (input.action === "request") {
    const email = input.email.trim().toLowerCase();

    await enforceRateLimit(
      {
        scope: "auth:reset-pin:request",
        identifier: `${clientIp}:${email}`,
        maxAttempts: 8,
        windowSeconds: 300,
        blockSeconds: 300,
      },
      supabase
    );

    const user = await findUserByEmail(supabase, email);

    if (user && user.is_active && user.is_approved) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashResetToken(rawToken);
      const expiryIso = new Date(Date.now() + PIN_RESET_TTL_MS).toISOString();

      await updateUserAuthFields(supabase, user.id, {
        pin_reset_token: tokenHash,
        pin_reset_token_expiry: expiryIso,
      });

      const resetUrl = `${requestOrigin}/reset-pin?token=${encodeURIComponent(rawToken)}`;
      await sendPinResetEmail(email, resetUrl);

      await recordAuditEvent(
        {
          action: "request_pin_reset",
          resource: "users",
          actorId: user.id,
          targetId: user.id,
          actorRole: String(user.role || "user"),
          route: "/api/auth/reset-pin",
          method: "POST",
        },
        supabase
      );
    }

    return {
      ok: true,
      message: "If an active account exists for that email, a PIN reset link has been sent.",
    };
  }

  await enforceRateLimit(
    {
      scope: "auth:reset-pin:confirm",
      identifier: clientIp,
      maxAttempts: 8,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  const { token, pin } = input;
  const tokenHash = hashResetToken(token);
  const user = await findUserByPinResetToken(supabase, tokenHash);
  if (
    !user ||
    !user.pin_reset_token ||
    !constantTimeStringEqual(String(user.pin_reset_token), tokenHash)
  ) {
    throw new ValidationError(
      "Invalid or expired PIN reset link. Please request a new one."
    );
  }

  if (!user.is_active || !user.is_approved) {
    throw new ForbiddenError(
      "This account is inactive or pending approval. Contact library staff."
    );
  }

  const expiryMs = user.pin_reset_token_expiry
    ? Date.parse(String(user.pin_reset_token_expiry))
    : 0;
  if (!expiryMs || expiryMs < Date.now()) {
    await updateUserAuthFields(supabase, user.id, {
      pin_reset_token: null,
      pin_reset_token_expiry: null,
    });
    throw new ValidationError(
      "This PIN reset link has expired. Please request a new one."
    );
  }

  const hashedPin = await bcrypt.hash(pin, 12);
  const nowIso = new Date().toISOString();

  await Promise.all([
    updateUserAuthFields(supabase, user.id, {
      pin_code: hashedPin,
      pin_enabled: true,
      pin_set_at: nowIso,
      pin_reset_token: null,
      pin_reset_token_expiry: null,
    }),
    closeAllUserLoginSessions(supabase, user.id, nowIso),
  ]);

  await recordAuditEvent(
    {
      action: "confirm_pin_reset",
      resource: "users",
      actorId: user.id,
      targetId: user.id,
      actorRole: String(user.role || "user"),
      route: "/api/auth/reset-pin",
      method: "POST",
    },
    supabase
  );

  return {
    ok: true,
    message: "Your 6-digit security PIN has been updated.",
  };
}
