import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "icpl_session";
export const SESSION_MAX_AGE_SEC = 3600; // 1 hour (matches conn.py Layer 2)

export const PENDING_MFA_COOKIE_NAME = "icpl_pending_mfa";
export const PENDING_MFA_MAX_AGE_SEC = 600; // 10 minutes

export type MfaMethod = "otp" | "pin";

export interface SessionPayload {
  userId: number;
  role: "admin" | "librarian" | "user";
  email: string;
  sessionToken: string;
  exp: number;
}

export interface PendingMfaPayload {
  uid: number;
  step: MfaMethod;
  methods: MfaMethod[];
  exp: number;
}

interface SignedPendingMfaPayload extends PendingMfaPayload {
  typ: "pending_mfa";
}

/**
 * Returns the HMAC signing secret from environment variables.
 * In production, SECRET_KEY is strictly required (never falls back to a hardcoded string).
 * In non-production, SUPABASE_SECRET_KEY may be used as a fallback if SECRET_KEY is unset.
 */
export function getSigningSecret(): string {
  const secretKey = process.env.SECRET_KEY?.trim();
  if (secretKey) {
    return secretKey;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SECRET_KEY environment variable is required in production.");
  }

  const devFallback = process.env.SUPABASE_SECRET_KEY?.trim();
  if (devFallback) {
    return devFallback;
  }

  throw new Error(
    "SECRET_KEY (or SUPABASE_SECRET_KEY in non-production) environment variable must be set."
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

function signHmacToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

function verifyHmacToken(token: string | undefined): Record<string, unknown> | null {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  const expected = crypto
    .createHmac("sha256", getSigningSecret())
    .update(data)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function signSession(payload: Omit<SessionPayload, "exp">): string {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  };
  return signHmacToken(full);
}

export function verifySession(token: string | undefined): SessionPayload | null {
  const parsed = verifyHmacToken(token);
  if (!parsed) return null;
  if (parsed.typ === "pending_mfa") return null;

  const exp = typeof parsed.exp === "number" ? parsed.exp : 0;
  if (!exp || exp < Math.floor(Date.now() / 1000)) return null;
  if (
    typeof parsed.userId !== "number" ||
    typeof parsed.email !== "string" ||
    typeof parsed.sessionToken !== "string" ||
    (parsed.role !== "admin" && parsed.role !== "librarian" && parsed.role !== "user")
  ) {
    return null;
  }

  return {
    userId: parsed.userId,
    role: parsed.role,
    email: parsed.email,
    sessionToken: parsed.sessionToken,
    exp,
  };
}

export function signPendingMfaToken(payload: Omit<PendingMfaPayload, "exp">): string {
  const full: SignedPendingMfaPayload = {
    typ: "pending_mfa",
    uid: payload.uid,
    step: payload.step,
    methods: payload.methods,
    exp: Math.floor(Date.now() / 1000) + PENDING_MFA_MAX_AGE_SEC,
  };
  return signHmacToken(full);
}

export function verifyPendingMfaToken(token: string | undefined): PendingMfaPayload | null {
  const parsed = verifyHmacToken(token);
  if (!parsed) return null;
  if (parsed.typ !== "pending_mfa") return null;

  const exp = typeof parsed.exp === "number" ? parsed.exp : 0;
  if (!exp || exp < Math.floor(Date.now() / 1000)) return null;

  const uid = parsed.uid;
  const step = parsed.step;
  const methods = parsed.methods;

  if (typeof uid !== "number" || !Number.isInteger(uid) || uid <= 0) return null;
  if (step !== "otp" && step !== "pin") return null;
  if (
    !Array.isArray(methods) ||
    methods.length === 0 ||
    !methods.every((m) => m === "otp" || m === "pin") ||
    !methods.includes(step)
  ) {
    return null;
  }

  return {
    uid,
    step,
    methods: methods as MfaMethod[],
    exp,
  };
}

export async function getServerSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  return verifySession(raw);
}

export async function getPendingMfaSession(): Promise<PendingMfaPayload | null> {
  const store = await cookies();
  const raw = store.get(PENDING_MFA_COOKIE_NAME)?.value;
  return verifyPendingMfaToken(raw);
}
