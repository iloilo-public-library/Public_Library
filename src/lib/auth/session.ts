import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "icpl_session";
const SESSION_MAX_AGE_SEC = 3600; // 1 hour (matches conn.py Layer 2)

export interface SessionPayload {
  userId: number;
  role: "admin" | "librarian" | "user";
  email: string;
  sessionToken: string;
  exp: number;
}

function getSigningSecret(): string {
  return (
    process.env.SECRET_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "icpl-dev-fallback-secret-change-me"
  );
}

/**
 * Computes the same HMAC-SHA256 blind index used by Python helpers.py
 * when EMAIL_ENCRYPTION_KEY is provided in .env.local.
 */
export function emailBlindIndex(email: string): string | null {
  const emailKey = process.env.EMAIL_ENCRYPTION_KEY;
  if (!emailKey) return null;
  return crypto
    .createHmac("sha256", Buffer.from(emailKey, "utf-8"))
    .update(email.trim().toLowerCase(), "utf-8")
    .digest("hex");
}

export function createSessionToken(): string {
  return crypto.randomBytes(16).toString("hex"); // 32 chars (matches login_sessions.session_token CHAR(32))
}

export function signSession(payload: Omit<SessionPayload, "exp">): string {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  };
  const data = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = crypto
    .createHmac("sha256", getSigningSecret())
    .update(data)
    .digest("base64url");

  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as SessionPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  return verifySession(raw);
}
