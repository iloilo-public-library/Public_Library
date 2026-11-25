import type { SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { SessionPayload } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { STAFF_ROLES } from "@/config/constants";
import { safeDecryptPii } from "@/lib/crypto/fernet";
import { mapDatabaseError } from "@/lib/errors";
import {
  AdminMutationError,
  formatFullName,
  resolveEmail,
} from "@/repositories/shared";
import {
  adminChangePasswordSchema,
  adminSetPinSchema,
  adminToggleSecuritySchema,
  adminUpdateProfileSchema,
} from "@/validators/admin";

const PIN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_HISTORY_DAYS = 366;
const SESSION_HISTORY_LIMIT = 1000;

export async function queryAdminProfile(
  supabase: SupabaseClient,
  sessionUserId: number | null
) {
  if (!sessionUserId) {
    throw new AdminMutationError("Unauthorized — please log in.", 401);
  }

  // Repository-level RBAC verification
  await verifyRepositoryActor(supabase, sessionUserId, STAFF_ROLES);

  const cutoffIso = new Date(
    Date.now() - SESSION_HISTORY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const [userRes, sessionsRes] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, username, email_display, firstname, lastname, gender, phone_number, role, is_active, is_approved, otp_enabled, pin_enabled, pin_code, pin_set_at, created_at, last_seen"
      )
      .eq("id", sessionUserId)
      .single(),
    supabase
      .from("login_sessions")
      .select("id, session_token, login_at, last_active_at, logout_at")
      .eq("user_id", sessionUserId)
      .gte("login_at", cutoffIso)
      .order("login_at", { ascending: false })
      .limit(SESSION_HISTORY_LIMIT),
  ]);

  if (userRes.error) {
    throw mapDatabaseError(userRes.error, "Failed to load admin profile.");
  }

  const u = userRes.data;
  const hasPin = Boolean(u.pin_code);
  const pinSetMs = u.pin_set_at ? Date.parse(String(u.pin_set_at)) : NaN;
  const pinExpired = Boolean(
    hasPin && (!Number.isFinite(pinSetMs) || Date.now() - pinSetMs > PIN_EXPIRY_MS)
  );

  const firstname = safeDecryptPii(u.firstname);
  const lastname = safeDecryptPii(u.lastname);
  const fullname = formatFullName(u.firstname, u.lastname);
  const initials =
    `${firstname.trim()[0] ?? ""}${lastname.trim()[0] ?? ""}`.toUpperCase() || "A";

  return {
    profile: {
      id: u.id,
      email: resolveEmail(u.email_display, u.username),
      firstname,
      lastname,
      fullname,
      initials,
      gender: safeDecryptPii(u.gender),
      phone_number: safeDecryptPii(u.phone_number),
      role: u.role,
      is_active: u.is_active,
      is_approved: u.is_approved,
      otp_enabled: u.otp_enabled,
      pin_enabled: u.pin_enabled,
      has_pin: hasPin,
      pin_expired: pinExpired,
      created_at: u.created_at,
      last_seen: u.last_seen,
    },
    loginActivity: sessionsRes.data ?? [],
  };
}

export async function mutateAdminProfile(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  payload: Record<string, unknown>
) {
  await verifyRepositoryActor(supabase, session.userId, STAFF_ROLES);

  if (action === "update_profile") {
    const parsed = adminUpdateProfileSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid profile details.",
        400
      );
    }

    const { firstname, lastname, gender, phone_number } = parsed.data;
    const { error } = await supabase
      .from("users")
      .update({
        firstname,
        lastname,
        gender: gender || null,
        phone_number: phone_number || null,
      })
      .eq("id", session.userId);

    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      target_user_id: session.userId,
      audit_details: "action=update_profile",
      profile: {
        firstname,
        lastname,
        fullname: `${firstname} ${lastname}`.trim(),
        initials: `${firstname[0] ?? ""}${lastname[0] ?? ""}`.toUpperCase() || "A",
        gender,
        phone_number,
      },
    };
  }

  if (action === "change_password") {
    const parsed = adminChangePasswordSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid password input.",
        400
      );
    }

    const { current_password, new_password } = parsed.data;
    const { data: user } = await supabase
      .from("users")
      .select("password")
      .eq("id", session.userId)
      .single();

    if (!user || !(await bcrypt.compare(current_password, user.password as string))) {
      throw new AdminMutationError("Current password is incorrect.", 403);
    }

    // Match legacy-flask/routes/admin_routes.py line 347: forbid reusing current password
    if (await bcrypt.compare(new_password, user.password as string)) {
      throw new AdminMutationError(
        "New password must be different from the current one.",
        400
      );
    }

    const hashed = await bcrypt.hash(new_password, 12);
    const { error } = await supabase
      .from("users")
      .update({
        password: hashed,
        failed_attempts: 0,
        is_locked: false,
        lock_until: null,
        reset_token: null,
        reset_token_expiry: null,
      })
      .eq("id", session.userId);

    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      target_user_id: session.userId,
      audit_details: "action=change_password",
    };
  }

  if (action === "toggle_security") {
    const parsed = adminToggleSecuritySchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid security method.",
        400
      );
    }

    const { method, enabled } = parsed.data;
    if (method === "pin" && enabled) {
      const { data: user, error: userErr } = await supabase
        .from("users")
        .select("pin_code")
        .eq("id", session.userId)
        .single();
      if (userErr) throw new AdminMutationError(userErr.message, 500);
      if (!user?.pin_code) {
        throw new AdminMutationError(
          "Please set a 6-digit PIN before enabling PIN login.",
          400
        );
      }
    }

    const col = method === "otp" ? "otp_enabled" : "pin_enabled";
    const { error } = await supabase
      .from("users")
      .update({ [col]: enabled })
      .eq("id", session.userId);

    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      method,
      enabled,
      target_user_id: session.userId,
      audit_details: `action=toggle_security method=${method} enabled=${enabled}`,
    };
  }

  if (action === "set_pin") {
    const parsed = adminSetPinSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid PIN payload.",
        400
      );
    }

    const { password, pin } = parsed.data;
    const { data: user } = await supabase
      .from("users")
      .select("password")
      .eq("id", session.userId)
      .single();

    if (!user || !(await bcrypt.compare(password, user.password as string))) {
      throw new AdminMutationError("Current password is incorrect.", 403);
    }

    const hashedPin = await bcrypt.hash(pin, 12);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({
        pin_code: hashedPin,
        pin_enabled: true,
        pin_set_at: nowIso,
        pin_reset_token: null,
        pin_reset_token_expiry: null,
      })
      .eq("id", session.userId);

    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      has_pin: true,
      pin_enabled: true,
      target_user_id: session.userId,
      audit_details: "action=set_pin",
    };
  }

  throw new AdminMutationError(`Unknown admin_profile action: ${action}`, 400);
}
