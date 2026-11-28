import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  signCaptchaChallenge,
  signVerifiedCaptchaToken,
  verifyCaptchaChallengeToken,
} from "@/lib/auth/captcha";
import { toErrorResponse } from "@/lib/errors";
import { verifyCaptchaSchema } from "@/validators/auth";

function constantTimeAnswerMatch(candidate: string, expected: string): boolean {
  const hashA = crypto.createHash("sha256").update(candidate, "utf-8").digest();
  const hashB = crypto.createHash("sha256").update(expected, "utf-8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export async function GET() {
  try {
    const a = crypto.randomInt(2, 16);
    const b = crypto.randomInt(1, 10);
    const isAdd = crypto.randomInt(0, 2) === 0;
    const question = isAdd ? `${a} + ${b} = ?` : `${a + b} - ${b} = ?`;
    const answer = isAdd ? String(a + b) : String(a);
    const { token, exp } = signCaptchaChallenge(answer);

    return NextResponse.json({
      ok: true,
      question,
      token,
      expiresAt: new Date(exp).toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const parsed = verifyCaptchaSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Invalid CAPTCHA submission." },
        { status: 400 }
      );
    }

    const challenge = verifyCaptchaChallengeToken(parsed.data.token);
    if (!challenge) {
      return NextResponse.json(
        { ok: false, error: "CAPTCHA challenge expired or invalid. Please refresh." },
        { status: 400 }
      );
    }

    if (!constantTimeAnswerMatch(parsed.data.answer.trim(), challenge.expected)) {
      return NextResponse.json(
        { ok: false, error: "Incorrect CAPTCHA answer. Please try again." },
        { status: 400 }
      );
    }

    const { captcha_token, expiresAt } = signVerifiedCaptchaToken();
    return NextResponse.json({
      ok: true,
      verified: true,
      captcha_token,
      expiresAt,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
