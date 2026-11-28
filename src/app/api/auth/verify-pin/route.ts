import { NextResponse } from "next/server";
import {
  getPendingMfaSession,
  PENDING_MFA_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
} from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/rate-limit";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { AppError, toErrorResponse } from "@/lib/errors";
import { verifyPinService } from "@/services/auth.service";
import { verifyPinSchema } from "@/validators/auth";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const parsed = verifyPinSchema.parse(rawBody);
    const pendingMfa = await getPendingMfaSession();
    if (!pendingMfa) {
      return NextResponse.json(
        { ok: false, error: "MFA verification session is missing or expired. Please sign in again." },
        { status: 401 }
      );
    }

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);
    const origin = new URL(request.url).origin;
    const result = await verifyPinService(
      supabase,
      pendingMfa,
      parsed,
      origin,
      getClientIp(request)
    );

    const response = NextResponse.json({
      ok: true,
      verified: true,
      role: result.role,
      redirectUrl: result.redirectUrl,
    });

    response.cookies.set(PENDING_MFA_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    response.cookies.set(SESSION_COOKIE_NAME, result.signedCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SEC,
    });

    return response;
  } catch (err) {
    const response = toErrorResponse(err);
    if (
      err instanceof AppError &&
      err.details &&
      typeof err.details === "object" &&
      "clearPendingMfa" in err.details &&
      (err.details as { clearPendingMfa?: boolean }).clearPendingMfa
    ) {
      response.cookies.set(PENDING_MFA_COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
    }
    return response;
  }
}
