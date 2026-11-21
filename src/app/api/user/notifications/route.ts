import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getMemberNotifications, updateMemberNotificationState } from "@/repositories/member";
import { AdminMutationError } from "@/repositories/shared";
import { userNotificationActionSchema } from "@/validators/user";

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
    const result = await getMemberNotifications(supabase, session.userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load notifications.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = userNotificationActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid notification action." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient(true);
  try {
    const data = parsed.data;
    const announcementId = data.action === "read_all" ? undefined : data.announcement_id;
    const result = await updateMemberNotificationState(
      supabase,
      session.userId,
      data.action,
      announcementId
    );
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof AdminMutationError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Failed to update notification.";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
