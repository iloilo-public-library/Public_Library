import type { SupabaseClient } from "@supabase/supabase-js";
import { emailBlindIndex } from "@/lib/auth/session";
import { mapDatabaseError } from "@/lib/errors";
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

function buildEmailLookupFilter(rawEmail: string): string {
  const email = rawEmail.trim().toLowerCase();
  const safeEmail = email.replace(/"/g, "");
  const lookupKeys = Array.from(
    new Set([email, emailBlindIndex(email)].filter((k): k is string => Boolean(k)))
  );
  const inClause = lookupKeys.map((k) => `"${k.replace(/"/g, "")}"`).join(",");
  return `username.in.(${inClause}),email_display.eq."${safeEmail}"`;
}

export async function findUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<AuthUserRow | null> {
  const { data, error } = await supabase
    .from("users")
    .select(AUTH_USER_SELECT)
    .or(buildEmailLookupFilter(email))
    .limit(1);

  if (error) {
    throw mapDatabaseError(error, "Failed to query user account.");
  }
  return ((data?.[0] as unknown) as AuthUserRow | undefined) ?? null;
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
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .or(buildEmailLookupFilter(email))
    .limit(1);

  if (error) {
    throw mapDatabaseError(error, "Failed to check email availability.");
  }
  return (data?.length ?? 0) > 0;
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
