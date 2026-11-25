import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/rate-limit";
import { AppError, toErrorResponse } from "@/lib/errors";
import { authenticateUserLogin } from "@/services/auth.service";
import { loginSchema } from "@/validators/auth";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  try {
    const parsed = loginSchema.parse(rawBody);

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
    const result = await authenticateUserLogin(
      supabase,
      parsed,
      getClientIp(request)
    );

    const response = NextResponse.json({
      ok: true,
      redirectTo: result.redirectTo,
      user: result.user,
    });

    response.cookies.set(SESSION_COOKIE_NAME, result.signedCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 3600,
    });

    return response;
  } catch (err) {
    if (err instanceof AppError && err.code === "PENDING_APPROVAL") {
      return NextResponse.json(
        {
          ok: false,
          pendingApproval: true,
          error: err.message,
        },
        { status: err.status }
      );
    }
    return toErrorResponse(err);
  }
}
