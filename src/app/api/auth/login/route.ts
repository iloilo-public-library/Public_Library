import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { recordErrorLog } from "@/lib/audit/error-logger";
import {
  createSessionToken,
  emailBlindIndex,
  SESSION_COOKIE_NAME,
  signSession,
} from "@/lib/auth/session";

interface DbUser {
  id: number;
  username: string;
  password: string;
  role: "admin" | "librarian" | "user";
  is_approved: boolean;
  is_active: boolean;
  is_locked: boolean;
  failed_attempts: number;
  lock_until: string | null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Please enter both your email and password." },
        { status: 400 }
      );
    }

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "SUPABASE_SECRET_KEY is missing in this runtime. Locally: stop (Ctrl+C) and restart `npm run dev` after saving .env.local. On Vercel: add SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Project Settings → Environment Variables and Redeploy.",
        },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);

    // Match either HMAC blind index (migrated accounts), plain lowercase username, or email_display
    const lookupKeys = Array.from(
      new Set([email, emailBlindIndex(email)].filter((k): k is string => Boolean(k)))
    );
    const safeEmail = email.replace(/"/g, "");

    const { data: users, error: queryError } = await supabase
      .from("users")
      .select(
        "id, username, email_display, password, role, is_approved, is_active, is_locked, failed_attempts, lock_until"
      )
      .or(
        `username.in.(${lookupKeys.map((k) => `"${k.replace(/"/g, "")}"`).join(",")}),email_display.eq."${safeEmail}"`
      )
      .limit(1);

    if (queryError) {
      await recordErrorLog(
        {
          level: "error",
          source: "Database",
          route: "/api/auth/login",
          method: "POST",
          status_code: 500,
          message: `Login query failed: ${queryError.message}`,
          user_email: email,
        },
        supabase
      );
      return NextResponse.json(
        {
          ok: false,
          error: `Supabase query failed: ${queryError.message}. Make sure you ran 001_initial_schema.sql in Supabase SQL Editor.`,
        },
        { status: 500 }
      );
    }

    const user = (users?.[0] ?? null) as DbUser | null;
    if (!user) {
      await recordErrorLog(
        {
          level: "warning",
          source: "Auth",
          route: "/api/auth/login",
          method: "POST",
          status_code: 401,
          message: "Failed login attempt for unknown account",
          user_email: email,
        },
        supabase
      );
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      await recordErrorLog(
        {
          level: "security",
          source: "Auth",
          route: "/api/auth/login",
          method: "POST",
          status_code: 403,
          message: `Blocked sign-in to deactivated account #${user.id}`,
          user_email: email,
        },
        supabase
      );
      return NextResponse.json(
        { ok: false, error: "This account has been deactivated. Contact library staff." },
        { status: 403 }
      );
    }

    if (!user.is_approved) {
      await recordErrorLog(
        {
          level: "warning",
          source: "Auth",
          route: "/api/auth/login",
          method: "POST",
          status_code: 403,
          message: `Sign-in attempted while pending approval (User #${user.id})`,
          user_email: email,
        },
        supabase
      );
      return NextResponse.json(
        {
          ok: false,
          pendingApproval: true,
          error: "Your account is still pending administrator approval.",
        },
        { status: 403 }
      );
    }

    // Lockout check (5 failed attempts -> 15 min lock)
    if (user.is_locked && user.lock_until) {
      const lockUntilDate = new Date(user.lock_until);
      if (lockUntilDate > new Date()) {
        return NextResponse.json(
          {
            ok: false,
            error: "Account temporarily locked due to multiple failed attempts. Try again later.",
          },
          { status: 423 }
        );
      }
      await supabase
        .from("users")
        .update({ is_locked: false, failed_attempts: 0, lock_until: null })
        .eq("id", user.id);
      user.failed_attempts = 0;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      const nextAttempts = (user.failed_attempts ?? 0) + 1;
      if (nextAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await supabase
          .from("users")
          .update({ failed_attempts: nextAttempts, is_locked: true, lock_until: lockUntil })
          .eq("id", user.id);
        await recordErrorLog(
          {
            level: "security",
            source: "Auth",
            route: "/api/auth/login",
            method: "POST",
            status_code: 423,
            message: `Account #${user.id} locked after ${nextAttempts} failed login attempts`,
            details: `Locked until ${lockUntil}`,
            user_email: email,
          },
          supabase
        );
        return NextResponse.json(
          { ok: false, error: "Too many failed attempts. Account locked for 15 minutes." },
          { status: 423 }
        );
      }

      await supabase
        .from("users")
        .update({ failed_attempts: nextAttempts })
        .eq("id", user.id);

      await recordErrorLog(
        {
          level: "warning",
          source: "Auth",
          route: "/api/auth/login",
          method: "POST",
          status_code: 401,
          message: `Invalid password attempt (${nextAttempts}/5) for User #${user.id}`,
          user_email: email,
        },
        supabase
      );

      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Login succeeded — reset attempts, mark active, record login session
    const nowIso = new Date().toISOString();
    const sessionToken = createSessionToken();

    await Promise.all([
      supabase
        .from("users")
        .update({
          failed_attempts: 0,
          is_locked: false,
          lock_until: null,
          status: "active",
          last_seen: nowIso,
        })
        .eq("id", user.id),
      supabase.from("login_sessions").insert({
        user_id: user.id,
        session_token: sessionToken,
        login_at: nowIso,
        last_active_at: nowIso,
      }),
    ]);

    const redirectTo =
      user.role === "admin"
        ? "/dashboard"
        : user.role === "librarian"
          ? "/librarian/dashboard"
          : "/user/home";

    const signedCookie = signSession({
      userId: user.id,
      role: user.role,
      email,
      sessionToken,
    });

    const response = NextResponse.json({
      ok: true,
      redirectTo,
      user: {
        id: user.id,
        role: user.role,
        email,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, signedCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 3600,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    await recordErrorLog({
      level: "error",
      source: "Auth",
      route: "/api/auth/login",
      method: "POST",
      status_code: 500,
      message,
      details: err instanceof Error ? err.stack || "" : "",
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
