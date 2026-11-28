import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { touchSessionActivity } from "@/lib/auth/rbac";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getMemberFavorites, toggleMemberFavorite } from "@/repositories/member";
import { toErrorResponse } from "@/lib/errors";
import { userFavoriteSchema } from "@/validators/user";

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
    const result = await getMemberFavorites(supabase, session.userId, session.sessionToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = userFavoriteSchema.safeParse(rawBody);
  if (!parsed.success) {
    return toErrorResponse(parsed.error);
  }

  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  const supabase = createSupabaseServerClient(true);
  try {
    const result = await toggleMemberFavorite(
      supabase,
      session.userId,
      parsed.data.book_id,
      session.sessionToken
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return toErrorResponse(err);
  }
}
