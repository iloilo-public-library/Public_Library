import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { emailBlindIndex } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      firstname?: string;
      lastname?: string;
      email?: string;
      password?: string;
    };

    const firstname = (body.firstname ?? "").trim();
    const lastname = (body.lastname ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!firstname || !lastname || !email || !password) {
      return NextResponse.json(
        { ok: false, error: "Please fill in your name, email, and password." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "SUPABASE_SECRET_KEY is missing in this runtime. Locally: restart `npm run dev` after saving .env.local. On Vercel: add SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Project Settings → Environment Variables and Redeploy.",
        },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);
    const usernameKey = emailBlindIndex(email) ?? email;

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .in("username", [usernameKey, email])
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const { data: inserted, error: insertError } = await supabase
      .from("users")
      .insert({
        username: usernameKey,
        email_display: email,
        firstname,
        lastname,
        password: hashedPassword,
        role: "user",
        is_active: true,
        is_approved: false,
        status: "offline",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { ok: false, error: insertError?.message || "Failed to create account." },
        { status: 500 }
      );
    }

    await supabase.from("account_requests").insert({
      user_id: inserted.id,
      username: usernameKey,
      request_type: "register",
      reason: "New user registration awaiting admin approval.",
      status: "pending",
    });

    return NextResponse.json({
      ok: true,
      message: "Registration submitted! Your account is now awaiting administrator approval.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
