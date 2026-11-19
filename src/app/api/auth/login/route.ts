import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

    const secretKey = process.env.SUPABASE_SECRET_KEY || "";
    if (!secretKey || secretKey.startsWith("REPLACE_")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "SUPABASE_SECRET_KEY is not set in .env.local yet. Paste your full secret key from Supabase Dashboard → Project Settings → API Keys and restart the server.",
        },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);

    // Match either HMAC blind index (migrated accounts) or plain lowercase email (new accounts)
    const lookupKeys = [email];
    const hashedEmail = emailBlindIndex(email);
    if (hashedEmail) lookupKeys.unshift(hashedEmail);

    const { data: users, error: queryError } = await supabase
      .from("users")
      .select(
        "id, username, password, role, is_approved, is_active, is_locked, failed_attempts, lock_until"
      )
      .in("username", lookupKeys)
      .limit(1);

    if (queryError) {
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
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { ok: false, error: "This account has been deactivated. Contact library staff." },
        { status: 403 }
      );
    }

    if (!user.is_approved) {
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
        return NextResponse.json(
          { ok: false, error: "Too many failed attempts. Account locked for 15 minutes." },
          { status: 423 }
        );
      }

      await supabase
        .from("users")
        .update({ failed_attempts: nextAttempts })
        .eq("id", user.id);

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
      user.role === "admin" || user.role === "librarian" ? "/dashboard" : "/user/home";

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
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
