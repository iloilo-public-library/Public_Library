import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getMemberBorrowedBooks } from "@/repositories/member";
import { recordErrorLog } from "@/lib/audit/error-logger";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — please sign in." },
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
  try {
    const result = await getMemberBorrowedBooks(supabase, session.userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load borrowed books.";
    await recordErrorLog(
      {
        level: "error",
        source: "User",
        route: "/api/user/borrowed-books",
        method: "GET",
        status_code: 500,
        message,
        user_email: session.email,
      },
      supabase
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
