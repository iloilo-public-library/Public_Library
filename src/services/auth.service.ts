import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSessionToken,
  signSession,
  type SessionPayload,
} from "@/lib/auth/session";
import { touchSessionActivity } from "@/lib/auth/rbac";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { maybeEncryptPii } from "@/lib/crypto/fernet";
import {
  sendOtpEmail,
  sendPasswordResetEmail,
  sendPinResetEmail,
} from "@/lib/email";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { resolveEmail } from "@/repositories/shared";
import {
  closeLoginSessionRow,
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

export async function authenticateUserLogin(
  supabase: SupabaseClient,
  input: LoginInput,
  clientIp: string
): Promise<{
  ok: true;
  redirectTo: string;
  signedCookie: string;
  user: { id: number; role: "admin" | "librarian" | "user"; email: string };
}> {
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

  // Check active lockout
  if (user.is_locked && user.lock_until) {
    const lockUntilDate = new Date(user.lock_until);
    if (lockUntilDate > new Date()) {
      throw new AppError(
        "Account temporarily locked due to multiple failed attempts. Try again later.",
        423,
        "ACCOUNT_LOCKED"
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
      throw new AppError(
        "Too many failed attempts. Account locked for 15 minutes.",
        423,
        "ACCOUNT_LOCKED"
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

  const nowIso = new Date().toISOString();
  const sessionToken = createSessionToken();
  const resolvedEmail = resolveEmail(user.email_display, user.username) || email;

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
      route: "/api/auth/login",
      method: "POST",
    },
    supabase
  );

  const redirectTo =
    user.role === "admin"
      ? "/dashboard"
      : user.role === "librarian"
        ? "/librarian/dashboard"
        : "/user/home";

  const signedCookie = signSession({
    userId: user.id,
    role: user.role,
    email: resolvedEmail,
    sessionToken,
  });

  return {
    ok: true,
    redirectTo,
    signedCookie,
    user: {
      id: user.id,
      role: user.role,
      email: resolvedEmail,
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
      await touchSessionActivity(session, supabase);
    } catch {
      // If DB check fails transiently, fall back to signed session token validity
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
  clientIp: string
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

  const hashedPassword = await bcrypt.hash(input.password, 12);
  const ageStr =
    input.age !== undefined && input.age !== null ? String(input.age).trim() : "";
  const phoneStr = (input.phone || input.phone_number || "").trim();
  const isGovernment =
    input.is_government === true ||
    input.is_government === "1" ||
    input.is_government === 1;
  const officePhone = (input.office_phone ?? "").trim();
  const validIdName = (input.valid_id_name ?? "").trim().slice(0, 480);

  const inserted = await insertNewUserAccount(supabase, {
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
    valid_id_path: validIdName ? maybeEncryptPii(validIdName) : null,
    is_active: true,
    is_approved: isStaffCreation,
    status: "offline",
  });

  if (!isStaffCreation) {
    await insertRegistrationRequest(supabase, inserted.id, email);
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

async function resolveTargetAuthUser(
  supabase: SupabaseClient,
  session: SessionPayload | null,
  targetEmail: string
): Promise<AuthUserRow | null> {
  if (session) {
    return findUserById(supabase, session.userId);
  }
  if (targetEmail) {
    return findUserByEmail(supabase, targetEmail);
  }
  return null;
}

export async function resendOtpService(
  supabase: SupabaseClient,
  session: SessionPayload | null,
  rawEmail: string | undefined,
  clientIp: string
): Promise<{ ok: true; message: string }> {
  const targetEmail = rawEmail?.trim().toLowerCase() || session?.email || "";
  if (!session && !targetEmail) {
    throw new UnauthorizedError("Unauthorized — sign in or supply your account email.");
  }

  await enforceRateLimit(
    {
      scope: "auth:resend-otp",
      identifier: `${clientIp}:${targetEmail || session?.userId || "anon"}`,
      maxAttempts: 5,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  const user = await resolveTargetAuthUser(supabase, session, targetEmail);
  if (user && user.is_active) {
    const otp = String(crypto.randomInt(100000, 1000000));
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiryIso = new Date(Date.now() + OTP_TTL_MS).toISOString();

    await updateUserAuthFields(supabase, user.id, {
      otp_code: hashedOtp,
      otp_expiry: expiryIso,
    });

    const deliveryEmail =
      targetEmail ||
      resolveEmail(user.email_display, user.username);
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
  }

  return {
    ok: true,
    message: "If an active account exists, a new 6-digit verification code has been sent.",
  };
}

export async function verifyOtpService(
  supabase: SupabaseClient,
  session: SessionPayload | null,
  input: { otp: string; email?: string },
  clientIp: string
): Promise<{ ok: true; verified: true }> {
  const targetEmail = input.email?.trim().toLowerCase() || session?.email || "";
  if (!session && !targetEmail) {
    throw new UnauthorizedError("Unauthorized — sign in or supply your account email.");
  }

  await enforceRateLimit(
    {
      scope: "auth:verify-otp",
      identifier: `${clientIp}:${targetEmail || session?.userId || "anon"}`,
      maxAttempts: 10,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  const user = await resolveTargetAuthUser(supabase, session, targetEmail);
  if (!user || !user.is_active) {
    throw new NotFoundError("Account not found or inactive.");
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
    : storedOtp.toUpperCase() === candidateOtp;

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

  return { ok: true, verified: true };
}

export async function verifyPinService(
  supabase: SupabaseClient,
  session: SessionPayload | null,
  input: { pin: string; email?: string },
  clientIp: string
): Promise<{ ok: true; verified: true }> {
  const targetEmail = input.email?.trim().toLowerCase() || session?.email || "";
  if (!session && !targetEmail) {
    throw new UnauthorizedError("Unauthorized — sign in or supply your account email.");
  }

  await enforceRateLimit(
    {
      scope: "auth:verify-pin",
      identifier: `${clientIp}:${targetEmail || session?.userId || "anon"}`,
      maxAttempts: 10,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  const user = await resolveTargetAuthUser(supabase, session, targetEmail);
  if (!user || !user.is_active) {
    throw new NotFoundError("Account not found or inactive.");
  }

  if (!user.pin_enabled || !user.pin_code) {
    throw new ValidationError("Security PIN is not configured for this account.");
  }

  const storedPin = String(user.pin_code);
  const isValid = storedPin.startsWith("$2")
    ? await bcrypt.compare(input.pin, storedPin)
    : storedPin === input.pin;

  if (!isValid) {
    throw new ForbiddenError("Incorrect security PIN. Please try again.");
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

  return { ok: true, verified: true };
}

export async function processPasswordResetService(
  supabase: SupabaseClient,
  input: ResetPasswordInput,
  requestOrigin: string,
  clientIp: string
): Promise<{ ok: true; message: string }> {
  await enforceRateLimit(
    {
      scope: `auth:reset-password:${input.action}`,
      identifier: clientIp,
      maxAttempts: 8,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  if (input.action === "request") {
    const email = input.email.trim().toLowerCase();
    const user = await findUserByEmail(supabase, email);

    if (user && user.is_active) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiryIso = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

      await updateUserAuthFields(supabase, user.id, {
        reset_token: token,
        reset_token_expiry: expiryIso,
      });

      const resetUrl = `${requestOrigin}/reset-password?token=${encodeURIComponent(token)}`;
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

  const { token, new_password } = input;
  const user = await findUserByPasswordResetToken(supabase, token);
  if (!user) {
    throw new ValidationError(
      "Invalid or expired reset link. Please request a new one."
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
  await updateUserAuthFields(supabase, user.id, {
    password: hashedPassword,
    reset_token: null,
    reset_token_expiry: null,
    is_locked: false,
    failed_attempts: 0,
    lock_until: null,
  });

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
  await enforceRateLimit(
    {
      scope: `auth:reset-pin:${input.action}`,
      identifier: clientIp,
      maxAttempts: 8,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  if (input.action === "request") {
    const email = input.email.trim().toLowerCase();
    const user = await findUserByEmail(supabase, email);

    if (user && user.is_active) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiryIso = new Date(Date.now() + PIN_RESET_TTL_MS).toISOString();

      await updateUserAuthFields(supabase, user.id, {
        pin_reset_token: token,
        pin_reset_token_expiry: expiryIso,
      });

      const resetUrl = `${requestOrigin}/reset-pin?token=${encodeURIComponent(token)}`;
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

  const { token, pin } = input;
  const user = await findUserByPinResetToken(supabase, token);
  if (!user) {
    throw new ValidationError(
      "Invalid or expired PIN reset link. Please request a new one."
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
  await updateUserAuthFields(supabase, user.id, {
    pin_code: hashedPin,
    pin_enabled: true,
    pin_set_at: nowIso,
    pin_reset_token: null,
    pin_reset_token_expiry: null,
  });

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
