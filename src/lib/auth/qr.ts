import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSessionToken, signSession } from "@/lib/auth/session";
import { enforceSystemMode } from "@/lib/auth/system-mode";
import { resolveEmail } from "@/repositories/shared";

export const QR_TOKEN_TTL_SEC = 60;

export interface QrTokenRow {
  id: number;
  token: string;
  user_id: number | null;
  status: "pending" | "confirmed" | "expired";
  created_at: string;
  expires_at: string;
}

export async function cleanupExpiredQrTokens(supabase: SupabaseClient): Promise<void> {
  const nowIso = new Date().toISOString();
  await supabase
    .from("qr_login_tokens")
    .delete()
    .lt("expires_at", nowIso)
    .neq("status", "confirmed");
}

export async function createQrLoginToken(supabase: SupabaseClient) {
  await cleanupExpiredQrTokens(supabase);

  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + QR_TOKEN_TTL_SEC * 1000).toISOString();

  const { error } = await supabase.from("qr_login_tokens").insert({
    token,
    user_id: null,
    status: "pending",
    created_at: createdAt,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Failed to create QR login token: ${error.message}`);
  }

  return {
    token,
    expiresAt,
    expiresIn: QR_TOKEN_TTL_SEC,
  };
}

export async function getQrTokenRow(
  supabase: SupabaseClient,
  token: string
): Promise<QrTokenRow | null> {
  const { data, error } = await supabase
    .from("qr_login_tokens")
    .select("id, token, user_id, status, created_at, expires_at")
    .eq("token", token)
    .limit(1);

  if (error) {
    throw new Error(`Failed to query QR token: ${error.message}`);
  }
  return (data?.[0] as QrTokenRow | undefined) ?? null;
}

export async function confirmQrToken(
  supabase: SupabaseClient,
  token: string,
  userId: number
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  await cleanupExpiredQrTokens(supabase);

  const row = await getQrTokenRow(supabase, token);
  if (!row) {
    return { ok: false, status: 404, error: "Invalid or expired QR code." };
  }

  if (Date.parse(row.expires_at) < Date.now()) {
    await supabase.from("qr_login_tokens").delete().eq("id", row.id);
    return { ok: false, status: 410, error: "QR code has expired." };
  }

  if (row.status === "confirmed") {
    return { ok: false, status: 409, error: "This QR code has already been used." };
  }

  const { error } = await supabase
    .from("qr_login_tokens")
    .update({ user_id: userId, status: "confirmed" })
    .eq("id", row.id);

  if (error) {
    throw new Error(`Failed to confirm QR token: ${error.message}`);
  }

  return { ok: true };
}

export async function consumeConfirmedQrToken(supabase: SupabaseClient, row: QrTokenRow) {
  if (!row.user_id) {
    return { ok: false as const, reason: "Missing user reference on QR token." };
  }

  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, username, email_display, role, is_active, is_approved, is_locked, lock_until")
    .eq("id", row.user_id)
    .single();

  // Delete the consumed token immediately so it cannot be replayed
  await supabase.from("qr_login_tokens").delete().eq("id", row.id);

  if (userErr || !user || !user.is_active || !user.is_approved) {
    return { ok: false as const, reason: "Account is inactive or pending approval." };
  }

  const isCurrentlyLocked =
    Boolean(user.is_locked) &&
    (!user.lock_until || Date.parse(String(user.lock_until)) > Date.now());
  if (isCurrentlyLocked) {
    return { ok: false as const, reason: "Account is temporarily locked." };
  }

  const nowIso = new Date().toISOString();
  const sessionToken = createSessionToken();
  const role = user.role as "admin" | "librarian" | "user";
  const email = resolveEmail(user.email_display, user.username);

  try {
    await enforceSystemMode(supabase, role);
  } catch (err) {
    return {
      ok: false as const,
      reason: err instanceof Error ? err.message : "System is temporarily unavailable.",
    };
  }

  await Promise.all([
    supabase
      .from("users")
      .update({
        status: "active",
        last_seen: nowIso,
        failed_attempts: 0,
        is_locked: false,
        lock_until: null,
      })
      .eq("id", user.id),
    supabase.from("login_sessions").insert({
      user_id: user.id,
      session_token: sessionToken,
      login_at: nowIso,
      last_active_at: nowIso,
    }),
  ]);

  const signedCookie = signSession({
    userId: user.id as number,
    role,
    email,
    sessionToken,
  });

  const redirectTo =
    role === "admin"
      ? "/dashboard"
      : role === "librarian"
        ? "/librarian/dashboard"
        : "/user/home";

  return {
    ok: true as const,
    signedCookie,
    redirectTo,
    user: { id: user.id as number, role, email },
  };
}
