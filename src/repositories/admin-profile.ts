import type { SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { SessionPayload } from "@/lib/auth/session";
import { safeDecryptPii } from "@/lib/crypto/fernet";
import {
  AdminMutationError,
  PW_ALLOWED_RE,
  PW_COMPLEXITY_RE,
  formatFullName,
  resolveEmail,
} from "@/repositories/shared";

export async function queryAdminProfile(
  supabase: SupabaseClient,
  sessionUserId: number | null
) {
  if (!sessionUserId) {
    throw new Error("Unauthorized");
  }
  const [userRes, sessionsRes] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, username, email_display, firstname, lastname, gender, phone_number, role, is_active, is_approved, otp_enabled, pin_enabled, created_at, last_seen"
      )
      .eq("id", sessionUserId)
      .single(),
    supabase
      .from("login_sessions")
      .select("id, session_token, login_at, last_active_at, logout_at")
      .eq("user_id", sessionUserId)
      .order("login_at", { ascending: false })
      .limit(15),
  ]);
  if (userRes.error) throw userRes.error;
  const u = userRes.data;
  return {
    profile: {
      id: u.id,
      email: resolveEmail(u.email_display, u.username),
      firstname: safeDecryptPii(u.firstname),
      lastname: safeDecryptPii(u.lastname),
      fullname: formatFullName(u.firstname, u.lastname),
      gender: safeDecryptPii(u.gender),
      phone_number: safeDecryptPii(u.phone_number),
      role: u.role,
      is_active: u.is_active,
      is_approved: u.is_approved,
      otp_enabled: u.otp_enabled,
      pin_enabled: u.pin_enabled,
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
  if (action === "update_profile") {
    const firstname = String(payload.firstname ?? "").trim();
    const lastname = String(payload.lastname ?? "").trim();
    const gender = String(payload.gender ?? "").trim();
    const phone = String(payload.phone_number ?? "").trim();

    if (firstname.length < 2 || lastname.length < 2) {
      throw new AdminMutationError("First name and last name must each be at least 2 characters.");
    }

    const { error } = await supabase
      .from("users")
      .update({
        firstname,
        lastname,
        gender: gender || null,
        phone_number: phone || null,
      })
      .eq("id", session.userId);

    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true };
  }

  if (action === "change_password") {
    const current = String(payload.current_password ?? "");
    const nextPw = String(payload.new_password ?? "");
    const confirm = String(payload.confirm_password ?? "");
    if (!current || !nextPw || !confirm) {
      throw new AdminMutationError("All password fields are required.");
    }
    if (nextPw !== confirm) {
      throw new AdminMutationError("New password and confirmation do not match.");
    }
    if (!PW_ALLOWED_RE.test(nextPw) || !PW_COMPLEXITY_RE.test(nextPw)) {
      throw new AdminMutationError(
        "New password must be 8-64 chars with uppercase, lowercase, number, and symbol (@$!%*?&_#^)."
      );
    }

    const { data: user } = await supabase
      .from("users")
      .select("password")
      .eq("id", session.userId)
      .single();

    if (!user || !(await bcrypt.compare(current, user.password as string))) {
      throw new AdminMutationError("Current password is incorrect.", 403);
    }

    const hashed = await bcrypt.hash(nextPw, 12);
    const { error } = await supabase
      .from("users")
      .update({
        password: hashed,
        failed_attempts: 0,
        is_locked: false,
        lock_until: null,
      })
      .eq("id", session.userId);

    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true };
  }

  if (action === "toggle_security") {
    const method = payload.method === "otp" ? "otp_enabled" : payload.method === "pin" ? "pin_enabled" : null;
    if (!method) throw new AdminMutationError("Invalid security method.");
    const { error } = await supabase
      .from("users")
      .update({ [method]: Boolean(payload.enabled) })
      .eq("id", session.userId);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true };
  }

  throw new AdminMutationError(`Unknown admin_profile action: ${action}`);
}
