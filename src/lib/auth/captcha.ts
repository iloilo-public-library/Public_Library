import crypto from "node:crypto";
import { getSigningSecret } from "@/lib/auth/session";

export const CAPTCHA_TTL_MS = 5 * 60 * 1000;

interface CaptchaChallengePayload {
  typ: "captcha_challenge";
  expected: string;
  exp: number;
}

interface CaptchaVerifiedPayload {
  typ: "captcha_verified";
  jti: string;
  exp: number;
}

// Track consumed verified-CAPTCHA jtis in memory with TTL pruning to prevent replay attacks.
const consumedCaptchaJtis = new Map<string, number>();

function pruneConsumedJtis(nowMs: number): void {
  for (const [jti, expMs] of consumedCaptchaJtis.entries()) {
    if (expMs <= nowMs) {
      consumedCaptchaJtis.delete(jti);
    }
  }
}

function signPayload(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

function verifyPayload(token: string | undefined): Record<string, unknown> | null {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(data)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
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

export function signCaptchaChallenge(expected: string): { token: string; exp: number } {
  const exp = Date.now() + CAPTCHA_TTL_MS;
  const payload: CaptchaChallengePayload = {
    typ: "captcha_challenge",
    expected,
    exp,
  };
  return { token: signPayload(payload), exp };
}

export function verifyCaptchaChallengeToken(
  token: string
): { expected: string; exp: number } | null {
  const parsed = verifyPayload(token);
  if (!parsed) return null;
  if (parsed.typ !== "captcha_challenge") return null;
  if (typeof parsed.expected !== "string" || typeof parsed.exp !== "number") return null;
  if (parsed.exp < Date.now()) return null;
  return { expected: parsed.expected, exp: parsed.exp };
}

export function signVerifiedCaptchaToken(): {
  captcha_token: string;
  expiresAt: string;
} {
  const jti = crypto.randomBytes(16).toString("hex");
  const exp = Date.now() + CAPTCHA_TTL_MS;
  const payload: CaptchaVerifiedPayload = {
    typ: "captcha_verified",
    jti,
    exp,
  };
  return {
    captcha_token: signPayload(payload),
    expiresAt: new Date(exp).toISOString(),
  };
}

export function consumeVerifiedCaptchaToken(token: string | undefined): {
  valid: boolean;
  reason?: string;
} {
  const now = Date.now();
  pruneConsumedJtis(now);

  const parsed = verifyPayload(token);
  if (!parsed || parsed.typ !== "captcha_verified") {
    return {
      valid: false,
      reason: "Invalid or expired CAPTCHA verification. Please complete the CAPTCHA again.",
    };
  }

  const jti = typeof parsed.jti === "string" ? parsed.jti : "";
  const exp = typeof parsed.exp === "number" ? parsed.exp : 0;

  if (!jti || jti.length < 16 || !exp || exp < now) {
    return {
      valid: false,
      reason: "CAPTCHA verification has expired. Please complete the CAPTCHA again.",
    };
  }

  if (consumedCaptchaJtis.has(jti)) {
    return {
      valid: false,
      reason: "CAPTCHA verification has already been used. Please complete a new CAPTCHA.",
    };
  }

  consumedCaptchaJtis.set(jti, exp);
  return { valid: true };
}
