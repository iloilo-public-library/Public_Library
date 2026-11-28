import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC } from "@/config/constants";
import { getServerSession, signSession } from "@/lib/auth/session";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getActiveSessionStatus } from "@/services/auth.service";

export async function GET() {
  const session = await getServerSession();
  const supabase = getSupabaseSecretKey() ? createSupabaseServerClient(true) : null;
  const status = await getActiveSessionStatus(session, supabase);
  const response = NextResponse.json(status);

  if (status.authenticated && session) {
    try {
      const refreshed = signSession({
        userId: session.userId,
        role: status.user?.role ?? session.role,
        email: status.user?.email ?? session.email,
        sessionToken: session.sessionToken,
      });
      response.cookies.set(SESSION_COOKIE_NAME, refreshed, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_MAX_AGE_SEC,
      });
    } catch {
      // Non-blocking if signing secret is unavailable
    }
  }

  return response;
}
