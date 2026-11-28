import type { SupabaseClient } from "@supabase/supabase-js";
import { emailBlindIndex } from "@/lib/auth/session";
import { mapDatabaseError } from "@/lib/errors";
import { resolveEmail } from "@/repositories/shared";
import type { UserRole } from "@/config/constants";

export interface AuthUserRow {
  id: number;
  username: string;
  email_display: string | null;
  firstname: string | null;
  lastname: string | null;
  password: string;
  role: UserRole;
  is_approved: boolean;
  is_active: boolean;
  is_locked: boolean;
  failed_attempts: number;
  lock_until: string | null;
  otp_enabled: boolean;
  otp_code: string | null;
  otp_expiry: string | null;
  pin_enabled: boolean;
  pin_code: string | null;
  pin_set_at: string | null;
  reset_token: string | null;
  reset_token_expiry: string | null;
  pin_reset_token: string | null;
  pin_reset_token_expiry: string | null;
}

const AUTH_USER_SELECT =
  "id, username, email_display, firstname, lastname, password, role, is_approved, is_active, is_locked, failed_attempts, lock_until, otp_enabled, otp_code, otp_expiry, pin_enabled, pin_code, pin_set_at, reset_token, reset_token_expiry, pin_reset_token, pin_reset_token_expiry";

function getEmailLookupCandidates(rawEmail: string): {
  normalizedEmail: string;
  usernameCandidates: string[];
} {
  const normalizedEmail = rawEmail.trim().toLowerCase();
  const blind = emailBlindIndex(normalizedEmail);
  const usernameCandidates = Array.from(
    new Set([normalizedEmail, blind].filter((k): k is string => Boolean(k)))
  );
  return { normalizedEmail, usernameCandidates };
}

export async function findUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<AuthUserRow | null> {
  const { normalizedEmail, usernameCandidates } = getEmailLookupCandidates(email);

  const { data: byUsername, error: usernameError } = await supabase
    .from("users")
    .select(AUTH_USER_SELECT)
    .in("username", usernameCandidates)
    .limit(1);

  if (usernameError) {
    throw mapDatabaseError(usernameError, "Failed to query user account.");
  }
  if (byUsername && byUsername.length > 0) {
    return (byUsername[0] as unknown) as AuthUserRow;
  }

  const { data: byDisplay, error: displayError } = await supabase
    .from("users")
    .select(AUTH_USER_SELECT)
    .eq("email_display", normalizedEmail)
    .limit(1);

  if (displayError) {
    throw mapDatabaseError(displayError, "Failed to query user account.");
  }
  return ((byDisplay?.[0] as unknown) as AuthUserRow | undefined) ?? null;
}

export async function findUserById(
  supabase: SupabaseClient,
  userId: number
): Promise<AuthUserRow | null> {
  const { data, error } = await supabase
    .from("users")
    .select(AUTH_USER_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw mapDatabaseError(error, "Failed to query user account.");
  }
  return ((data as unknown) as AuthUserRow | null) ?? null;
}

export async function isEmailRegistered(
  supabase: SupabaseClient,
  email: string
): Promise<boolean> {
  const { normalizedEmail, usernameCandidates } = getEmailLookupCandidates(email);

  const { data: byUsername, error: usernameError } = await supabase
    .from("users")
    .select("id")
    .in("username", usernameCandidates)
    .limit(1);

  if (usernameError) {
    throw mapDatabaseError(usernameError, "Failed to check email availability.");
  }
  if ((byUsername?.length ?? 0) > 0) {
    return true;
  }

  const { data: byDisplay, error: displayError } = await supabase
    .from("users")
    .select("id")
    .eq("email_display", normalizedEmail)
    .limit(1);

  if (displayError) {
    throw mapDatabaseError(displayError, "Failed to check email availability.");
  }
  return (byDisplay?.length ?? 0) > 0;
}

export async function findUserByPasswordResetToken(
  supabase: SupabaseClient,
  token: string
): Promise<AuthUserRow | null> {
  const { data, error } = await supabase
    .from("users")
    .select(AUTH_USER_SELECT)
    .eq("reset_token", token)
    .limit(1);

  if (error) {
    throw mapDatabaseError(error, "Failed to verify password reset token.");
  }
  return ((data?.[0] as unknown) as AuthUserRow | undefined) ?? null;
}

export async function findUserByPinResetToken(
  supabase: SupabaseClient,
  token: string
): Promise<AuthUserRow | null> {
  const { data, error } = await supabase
    .from("users")
    .select(AUTH_USER_SELECT)
    .eq("pin_reset_token", token)
    .limit(1);

  if (error) {
    throw mapDatabaseError(error, "Failed to verify PIN reset token.");
  }
  return ((data?.[0] as unknown) as AuthUserRow | undefined) ?? null;
}

export async function updateUserAuthFields(
  supabase: SupabaseClient,
  userId: number,
  fields: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("users").update(fields).eq("id", userId);
  if (error) {
    throw mapDatabaseError(error, "Failed to update account security state.");
  }
}

export async function recordLoginSessionRow(
  supabase: SupabaseClient,
  userId: number,
  sessionToken: string,
  nowIso: string
): Promise<void> {
  const { error } = await supabase.from("login_sessions").insert({
    user_id: userId,
    session_token: sessionToken,
    login_at: nowIso,
    last_active_at: nowIso,
  });
  if (error) {
    throw mapDatabaseError(error, "Failed to record login session.");
  }
}

export async function closeLoginSessionRow(
  supabase: SupabaseClient,
  userId: number,
  sessionToken: string,
  nowIso: string
): Promise<void> {
  await Promise.all([
    supabase
      .from("users")
      .update({ status: "offline", last_seen: nowIso })
      .eq("id", userId),
    supabase
      .from("login_sessions")
      .update({ logout_at: nowIso, last_active_at: nowIso })
      .eq("session_token", sessionToken)
      .is("logout_at", null),
  ]);
}

export async function closeAllUserLoginSessions(
  supabase: SupabaseClient,
  userId: number,
  nowIso: string
): Promise<void> {
  const { error } = await supabase
    .from("login_sessions")
    .update({ logout_at: nowIso, last_active_at: nowIso })
    .eq("user_id", userId)
    .is("logout_at", null);
  if (error) {
    throw mapDatabaseError(error, "Failed to close active login sessions.");
  }
}

export async function insertNewUserAccount(
  supabase: SupabaseClient,
  row: {
    username: string;
    email_display: string;
    firstname: string;
    lastname: string;
    password: string;
    role: UserRole;
    age: string | null;
    gender: string | null;
    phone_number: string | null;
    school: string | null;
    city: string | null;
    province: string | null;
    education_level: string | null;
    occupation: string | null;
    is_government: boolean;
    office_phone: string | null;
    valid_id_path: string | null;
    is_active: boolean;
    is_approved: boolean;
    status: string;
  }
): Promise<{ id: number }> {
  const { data, error } = await supabase
    .from("users")
    .insert(row)
    .select("id")
    .single();

  if (error || !data) {
    throw mapDatabaseError(error, "Failed to create account.");
  }
  return { id: Number(data.id) };
}

export async function insertRegistrationRequest(
  supabase: SupabaseClient,
  userId: number,
  username: string
): Promise<void> {
  const { error } = await supabase.from("account_requests").insert({
    user_id: userId,
    username,
    request_type: "register",
    reason: "New user registration awaiting admin approval.",
    status: "pending",
  });
  if (error) {
    throw mapDatabaseError(error, "Failed to record registration request.");
  }
}

export async function findActiveAdminEmails(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from("users")
    .select("username, email_display")
    .eq("role", "admin")
    .eq("is_active", true)
    .eq("is_approved", true);

  if (error) {
    throw mapDatabaseError(error, "Failed to load active administrator emails.");
  }

  const emails = new Set<string>();
  for (const row of data ?? []) {
    const resolved = resolveEmail(row.email_display, row.username).trim().toLowerCase();
    if (resolved.includes("@")) {
      emails.add(resolved);
    }
  }
  return Array.from(emails);
}

export async function clearExpiredOtpRows(
  supabase: SupabaseClient,
  nowIso: string
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ otp_code: null, otp_expiry: null })
    .not("otp_expiry", "is", null)
    .lt("otp_expiry", nowIso);

  if (error) {
    throw mapDatabaseError(error, "Failed to clean up expired OTP codes.");
  }
}
