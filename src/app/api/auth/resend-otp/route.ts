import crypto from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { emailBlindIndex, getServerSession } from "@/lib/auth/session";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { sendOtpEmail } from "@/lib/email";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { resendOtpSchema } from "@/validators/auth";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request: Request) {
  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  let rawBody: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) rawBody = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = resendOtpSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid email." },
      { status: 400 }
    );
  }

  const session = await getServerSession();
  const targetEmail = parsed.data.email?.trim().toLowerCase() || session?.email || "";
  if (!session && !targetEmail) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — sign in or supply your account email." },
      { status: 401 }
    );
  }

  const supabase = createSupabaseServerClient(true);
  try {
    let query = supabase
      .from("users")
      .select("id, role, email_display, is_active");

    if (session) {
      query = query.eq("id", session.userId);
    } else {
      const lookupKeys = Array.from(
        new Set([targetEmail, emailBlindIndex(targetEmail)].filter((k): k is string => Boolean(k)))
      );
      query = query.or(
        `username.in.(${lookupKeys.map((k) => `"${k.replace(/"/g, "")}"`).join(",")}),email_display.eq."${targetEmail.replace(/"/g, "")}"`
      );
    }

    const { data: users, error } = await query.limit(1);
    if (error) throw error;

    const user = users?.[0];
    if (user && user.is_active) {
      const otp = String(crypto.randomInt(100000, 1000000));
      const hashedOtp = await bcrypt.hash(otp, 10);
      const expiryIso = new Date(Date.now() + OTP_TTL_MS).toISOString();

      const { error: updateErr } = await supabase
        .from("users")
        .update({ otp_code: hashedOtp, otp_expiry: expiryIso })
        .eq("id", user.id);

      if (updateErr) throw updateErr;

      const deliveryEmail = targetEmail || String(user.email_display || "");
      if (deliveryEmail.includes("@")) {
        await sendOtpEmail(deliveryEmail, otp);
      }

      await recordAuditEvent(
        {
          action: "resend_otp",
          resource: "users",
          targetId: user.id as number,
          actorEmail: deliveryEmail || `user#${user.id}`,
          actorRole: String(user.role || "user"),
          route: "/api/auth/resend-otp",
          method: "POST",
        },
        supabase
      );
    }

    return NextResponse.json({
      ok: true,
      message: "If an active account exists, a new 6-digit verification code has been sent.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send verification code.";
    await recordErrorLog(
      {
        level: "error",
        source: "Auth",
        route: "/api/auth/resend-otp",
        method: "POST",
        status_code: 500,
        message,
        user_email: targetEmail,
      },
      supabase
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
