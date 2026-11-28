import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { touchSessionActivity } from "@/lib/auth/rbac";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import {
  addMemberSearchHistory,
  clearMemberSearchHistory,
  getMemberSearchHistory,
} from "@/repositories/member";
import { toErrorResponse } from "@/lib/errors";
import { userSearchHistorySchema } from "@/validators/user";

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
    const result = await getMemberSearchHistory(supabase, session.userId, session.sessionToken);
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

  const parsed = userSearchHistorySchema.safeParse(rawBody);
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
    const result = await addMemberSearchHistory(
      supabase,
      session.userId,
      parsed.data.query,
      session.sessionToken
    );
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE() {
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
    const result = await clearMemberSearchHistory(supabase, session.userId, session.sessionToken);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
