import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = await getServerSession();

  if (session) {
    try {
      const supabase = createSupabaseServerClient(true);
      const nowIso = new Date().toISOString();
      await Promise.all([
        supabase
          .from("users")
          .update({ status: "offline", last_seen: nowIso })
          .eq("id", session.userId),
        supabase
          .from("login_sessions")
          .update({ logout_at: nowIso, last_active_at: nowIso })
          .eq("session_token", session.sessionToken),
      ]);
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
