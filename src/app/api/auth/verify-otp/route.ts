import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { emailBlindIndex, getServerSession } from "@/lib/auth/session";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { verifyOtpSchema } from "@/validators/auth";

export async function POST(request: Request) {
  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = verifyOtpSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid OTP input." },
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
      .select("id, role, otp_code, otp_expiry, is_active");

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
    if (!user || !user.is_active) {
      return NextResponse.json({ ok: false, error: "Account not found or inactive." }, { status: 404 });
    }

    if (!user.otp_code || !user.otp_expiry) {
      return NextResponse.json(
        { ok: false, error: "No active verification code found. Please request a new OTP." },
        { status: 400 }
      );
    }

    const expiryMs = Date.parse(String(user.otp_expiry));
    if (Number.isNaN(expiryMs) || expiryMs < Date.now()) {
      await supabase
        .from("users")
        .update({ otp_code: null, otp_expiry: null })
        .eq("id", user.id);
      return NextResponse.json(
        { ok: false, error: "Verification code has expired. Please request a new OTP." },
        { status: 400 }
      );
    }

    const storedOtp = String(user.otp_code);
    const isValid = storedOtp.startsWith("$2")
      ? await bcrypt.compare(parsed.data.otp, storedOtp)
      : storedOtp === parsed.data.otp;

    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: "Invalid verification code. Please try again." },
        { status: 400 }
      );
    }

    await supabase
      .from("users")
      .update({ otp_code: null, otp_expiry: null })
      .eq("id", user.id);

    await recordAuditEvent(
      {
        action: "verify_otp",
        resource: "users",
        targetId: user.id as number,
        actorEmail: targetEmail || `user#${user.id}`,
        actorRole: String(user.role || "user"),
        route: "/api/auth/verify-otp",
        method: "POST",
      },
      supabase
    );

    return NextResponse.json({ ok: true, verified: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OTP verification failed.";
    await recordErrorLog(
      {
        level: "error",
        source: "Auth",
        route: "/api/auth/verify-otp",
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
