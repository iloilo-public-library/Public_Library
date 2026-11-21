import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { verifyCaptchaSchema } from "@/validators/auth";

const CAPTCHA_TTL_MS = 5 * 60 * 1000;

function getCaptchaSecret(): string {
  return (
    process.env.SECRET_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "icpl-dev-fallback-secret-change-me"
  );
}

function signChallenge(payload: { expected: string; exp: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getCaptchaSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

function verifyChallengeToken(token: string): { expected: string; exp: number } | null {
  if (!token.includes(".")) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getCaptchaSecret())
    .update(data)
    .digest("base64url");

  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as {
      expected?: string;
      exp?: number;
    };
    if (!parsed.expected || !parsed.exp || parsed.exp < Date.now()) return null;
    return { expected: parsed.expected, exp: parsed.exp };
  } catch {
    return null;
  }
}

export async function GET() {
  const a = crypto.randomInt(2, 16);
  const b = crypto.randomInt(1, 10);
  const isAdd = crypto.randomInt(0, 2) === 0;
  const question = isAdd ? `${a} + ${b} = ?` : `${a + b} - ${b} = ?`;
  const answer = isAdd ? String(a + b) : String(a);
  const exp = Date.now() + CAPTCHA_TTL_MS;
  const token = signChallenge({ expected: answer, exp });

  return NextResponse.json({
    ok: true,
    question,
    token,
    expiresAt: new Date(exp).toISOString(),
  });
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = verifyCaptchaSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid CAPTCHA submission." },
      { status: 400 }
    );
  }

  const challenge = verifyChallengeToken(parsed.data.token);
  if (!challenge) {
    return NextResponse.json(
      { ok: false, error: "CAPTCHA challenge expired or invalid. Please refresh." },
      { status: 400 }
    );
  }

  if (parsed.data.answer.trim() !== challenge.expected) {
    return NextResponse.json(
      { ok: false, error: "Incorrect CAPTCHA answer. Please try again." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, verified: true });
}
