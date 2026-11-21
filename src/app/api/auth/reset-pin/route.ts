import crypto from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { emailBlindIndex } from "@/lib/auth/session";
import { sendPinResetEmail } from "@/lib/email";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { resetPinRequestSchema } from "@/validators/auth";

const PIN_RESET_TTL_MS = 30 * 60 * 1000;

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

  const parsed = resetPinRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || "Invalid request payload.";
    return NextResponse.json({ ok: false, error: firstIssue }, { status: 400 });
  }

  const supabase = createSupabaseServerClient(true);

  try {
    if (parsed.data.action === "request") {
      const email = parsed.data.email;
      const lookupKeys = [email];
      const hashedEmail = emailBlindIndex(email);
      if (hashedEmail) lookupKeys.unshift(hashedEmail);

      const { data: users, error: queryErr } = await supabase
        .from("users")
        .select("id, role, is_active")
        .in("username", lookupKeys)
        .limit(1);

      if (queryErr) throw queryErr;

      const user = users?.[0];
      if (user && user.is_active) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiryIso = new Date(Date.now() + PIN_RESET_TTL_MS).toISOString();

        const { error: updateErr } = await supabase
          .from("users")
          .update({
            pin_reset_token: token,
            pin_reset_token_expiry: expiryIso,
          })
          .eq("id", user.id);

        if (updateErr) throw updateErr;

        const origin = new URL(request.url).origin;
        const resetUrl = `${origin}/reset-pin?token=${encodeURIComponent(token)}`;
        await sendPinResetEmail(email, resetUrl);

        await recordAuditEvent(
          {
            action: "request_pin_reset",
            resource: "users",
            targetId: user.id as number,
            actorEmail: email,
            actorRole: String(user.role || "user"),
            route: "/api/auth/reset-pin",
            method: "POST",
          },
          supabase
        );
      }

      return NextResponse.json({
        ok: true,
        message: "If an active account exists for that email, a PIN reset link has been sent.",
      });
    }

    // Confirm PIN reset
    const { token, pin } = parsed.data;
    const { data: users, error: findErr } = await supabase
      .from("users")
      .select("id, role, pin_reset_token_expiry")
      .eq("pin_reset_token", token)
      .limit(1);

    if (findErr) throw findErr;

    const user = users?.[0];
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired PIN reset link. Please request a new one." },
        { status: 400 }
      );
    }

    const expiryMs = user.pin_reset_token_expiry
      ? Date.parse(String(user.pin_reset_token_expiry))
      : 0;
    if (!expiryMs || expiryMs < Date.now()) {
      await supabase
        .from("users")
        .update({ pin_reset_token: null, pin_reset_token_expiry: null })
        .eq("id", user.id);
      return NextResponse.json(
        { ok: false, error: "This PIN reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const hashedPin = await bcrypt.hash(pin, 12);
    const nowIso = new Date().toISOString();
    const { error: saveErr } = await supabase
      .from("users")
      .update({
        pin_code: hashedPin,
        pin_enabled: true,
        pin_set_at: nowIso,
        pin_reset_token: null,
        pin_reset_token_expiry: null,
      })
      .eq("id", user.id);

    if (saveErr) throw saveErr;

    await recordAuditEvent(
      {
        action: "confirm_pin_reset",
        resource: "users",
        targetId: user.id as number,
        actorEmail: `user#${user.id}`,
        actorRole: String(user.role || "user"),
        route: "/api/auth/reset-pin",
        method: "POST",
      },
      supabase
    );

    return NextResponse.json({
      ok: true,
      message: "Your 6-digit security PIN has been updated.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PIN reset failed.";
    await recordErrorLog(
      {
        level: "error",
        source: "Auth",
        route: "/api/auth/reset-pin",
        method: "POST",
        status_code: 500,
        message,
        details: err instanceof Error ? err.stack || "" : "",
      },
      supabase
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
