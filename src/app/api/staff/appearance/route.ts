import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { staffAppearanceSchema } from "@/validators/admin";

function isStaffRole(role: string | undefined): boolean {
  return role === "admin" || role === "librarian";
}

export async function GET() {
  const session = await getServerSession();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — staff access required." },
      { status: session ? 403 : 401 }
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
    // Prefer consolidated user_preferences (migration 004); fallback to staff_appearance
    const prefRes = await supabase
      .from("user_preferences")
      .select("theme, language, updated_at")
      .eq("user_id", session.userId)
      .limit(1);

    if (!prefRes.error && prefRes.data && prefRes.data.length > 0) {
      return NextResponse.json({ ok: true, appearance: prefRes.data[0] });
    }

    const legacyRes = await supabase
      .from("staff_appearance")
      .select("theme, language, updated_at")
      .eq("user_id", session.userId)
      .limit(1);

    const row = !legacyRes.error ? legacyRes.data?.[0] : null;
    return NextResponse.json({
      ok: true,
      appearance: row ?? { theme: "default", language: "english", updated_at: null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load staff appearance.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — staff access required." },
      { status: session ? 403 : 401 }
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

  const parsed = staffAppearanceSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid appearance preferences." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient(true);
  const payload = {
    user_id: session.userId,
    theme: parsed.data.theme,
    language: parsed.data.language,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error: prefErr } = await supabase
      .from("user_preferences")
      .upsert(payload, { onConflict: "user_id" });

    // Also keep staff_appearance in sync if it exists (or fallback if user_preferences isn't migrated yet)
    const { error: legacyErr } = await supabase
      .from("staff_appearance")
      .upsert(payload, { onConflict: "user_id" });

    if (prefErr && legacyErr) {
      throw prefErr;
    }

    await recordAuditEvent(
      {
        action: "update_staff_appearance",
        resource: "user_preferences",
        targetId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        route: "/api/staff/appearance",
        method: "PUT",
      },
      supabase
    );

    return NextResponse.json({ ok: true, appearance: parsed.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save staff appearance.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return PUT(request);
}
