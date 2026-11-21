import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { emailBlindIndex, getServerSession } from "@/lib/auth/session";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { verifyPinSchema } from "@/validators/auth";

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

  const parsed = verifyPinSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid PIN input." },
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
      .select("id, role, pin_enabled, pin_code, is_active");

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

    if (!user.pin_enabled || !user.pin_code) {
      return NextResponse.json(
        { ok: false, error: "Security PIN is not configured for this account." },
        { status: 400 }
      );
    }

    const storedPin = String(user.pin_code);
    const isValid = storedPin.startsWith("$2")
      ? await bcrypt.compare(parsed.data.pin, storedPin)
      : storedPin === parsed.data.pin;

    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: "Incorrect security PIN. Please try again." },
        { status: 403 }
      );
    }

    await recordAuditEvent(
      {
        action: "verify_pin",
        resource: "users",
        targetId: user.id as number,
        actorEmail: targetEmail || `user#${user.id}`,
        actorRole: String(user.role || "user"),
        route: "/api/auth/verify-pin",
        method: "POST",
      },
      supabase
    );

    return NextResponse.json({ ok: true, verified: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PIN verification failed.";
    await recordErrorLog(
      {
        level: "error",
        source: "Auth",
        route: "/api/auth/verify-pin",
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
