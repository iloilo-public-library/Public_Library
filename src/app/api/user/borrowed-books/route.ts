import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { touchSessionActivity } from "@/lib/auth/rbac";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getMemberBorrowedBooks } from "@/repositories/member";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { AppError, toErrorResponse } from "@/lib/errors";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — please sign in." },
      { status: 401 }
    );
  }
  if (session.role !== "user") {
    return NextResponse.json(
      { ok: false, error: "Forbidden — member access required." },
      { status: 403 }
    );
  }
  void touchSessionActivity(session);

  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  const supabase = createSupabaseServerClient(true);
  try {
    const result = await getMemberBorrowedBooks(supabase, session.userId, session.sessionToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (!(err instanceof AppError) || err.status >= 500) {
      await recordErrorLog(
        {
          level: "error",
          source: "User",
          route: "/api/user/borrowed-books",
          method: "GET",
          status_code: err instanceof AppError ? err.status : 500,
          message: err instanceof Error ? err.message : "Failed to load borrowed books.",
          user_email: session.email,
        },
        supabase
      );
    }
    return toErrorResponse(err);
  }
}
