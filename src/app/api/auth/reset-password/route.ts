import crypto from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { emailBlindIndex } from "@/lib/auth/session";
import { sendPasswordResetEmail } from "@/lib/email";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { resetPasswordRequestSchema } from "@/validators/auth";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

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

  const parsed = resetPasswordRequestSchema.safeParse(rawBody);
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
        const expiryIso = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

        const { error: updateErr } = await supabase
          .from("users")
          .update({
            reset_token: token,
            reset_token_expiry: expiryIso,
          })
          .eq("id", user.id);

        if (updateErr) throw updateErr;

        const origin = new URL(request.url).origin;
        const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
        await sendPasswordResetEmail(email, resetUrl);

        await recordAuditEvent(
          {
            action: "request_password_reset",
            resource: "users",
            targetId: user.id as number,
            actorEmail: email,
            actorRole: String(user.role || "user"),
            route: "/api/auth/reset-password",
            method: "POST",
          },
          supabase
        );
      }

      return NextResponse.json({
        ok: true,
        message:
          "If an active account exists for that email, a password reset link has been sent.",
      });
    }

    // Confirm password reset
    const { token, new_password } = parsed.data;
    const { data: users, error: findErr } = await supabase
      .from("users")
      .select("id, role, reset_token_expiry")
      .eq("reset_token", token)
      .limit(1);

    if (findErr) throw findErr;

    const user = users?.[0];
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    const expiryMs = user.reset_token_expiry ? Date.parse(String(user.reset_token_expiry)) : 0;
    if (!expiryMs || expiryMs < Date.now()) {
      await supabase
        .from("users")
        .update({ reset_token: null, reset_token_expiry: null })
        .eq("id", user.id);
      return NextResponse.json(
        { ok: false, error: "This reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);
    const { error: saveErr } = await supabase
      .from("users")
      .update({
        password: hashedPassword,
        reset_token: null,
        reset_token_expiry: null,
        is_locked: false,
        failed_attempts: 0,
        lock_until: null,
      })
      .eq("id", user.id);

    if (saveErr) throw saveErr;

    await recordAuditEvent(
      {
        action: "confirm_password_reset",
        resource: "users",
        targetId: user.id as number,
        actorEmail: `user#${user.id}`,
        actorRole: String(user.role || "user"),
        route: "/api/auth/reset-password",
        method: "POST",
      },
      supabase
    );

    return NextResponse.json({
      ok: true,
      message: "Your password has been updated. You can now sign in.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Password reset failed.";
    await recordErrorLog(
      {
        level: "error",
        source: "Auth",
        route: "/api/auth/reset-password",
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
