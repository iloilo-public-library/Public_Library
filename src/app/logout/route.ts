import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getServerSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { logoutUserSession } from "@/services/auth.service";

export async function GET(request: Request) {
  const session = await getServerSession();

  if (session && getSupabaseSecretKey()) {
    try {
      const supabase = createSupabaseServerClient(true);
      await logoutUserSession(supabase, session);
    } catch {
      // Ignore DB update errors on logout so cookie always clears cleanly
    }
  }

  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
