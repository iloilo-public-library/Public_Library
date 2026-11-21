import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "@/lib/auth/session";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import {
  maybeEncryptPii,
  nameBlindIndex,
  phoneBlindIndex,
  safeDecryptPii,
} from "@/lib/crypto/fernet";
import { formatFullName, resolveEmail } from "@/repositories/shared";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { userSettingsMutationSchema } from "@/validators/user";

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
    const [userRes, sessionsRes, favCountRes, searchCountRes, reqRes] = await Promise.all([
      supabase
        .from("users")
        .select(
          "id, username, email_display, firstname, lastname, gender, phone_number, city, province, school, occupation, role, is_active, is_approved, otp_enabled, pin_enabled, created_at, last_seen"
        )
        .eq("id", session.userId)
        .single(),
      supabase
        .from("login_sessions")
        .select("id, session_token, login_at, last_active_at, logout_at")
        .eq("user_id", session.userId)
        .order("login_at", { ascending: false })
        .limit(12),
      supabase
        .from("user_favorites")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.userId),
      supabase
        .from("user_search_history")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.userId),
      supabase
        .from("account_requests")
        .select("id, request_type, status, reason, admin_note, created_at")
        .eq("user_id", session.userId)
        .in("request_type", ["deactivate", "delete"])
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (userRes.error || !userRes.data) {
      return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404 });
    }

    const u = userRes.data;
    return NextResponse.json({
      ok: true,
      profile: {
        id: u.id,
        email: resolveEmail(u.email_display, u.username),
        firstname: safeDecryptPii(u.firstname),
        lastname: safeDecryptPii(u.lastname),
        fullname: formatFullName(u.firstname, u.lastname),
        gender: safeDecryptPii(u.gender),
        phone_number: safeDecryptPii(u.phone_number),
        city: safeDecryptPii(u.city),
        province: safeDecryptPii(u.province),
        school: safeDecryptPii(u.school),
        occupation: safeDecryptPii(u.occupation),
        role: u.role,
        is_active: u.is_active,
        is_approved: u.is_approved,
        otp_enabled: u.otp_enabled,
        pin_enabled: u.pin_enabled,
        created_at: u.created_at,
        last_seen: u.last_seen,
      },
      counts: {
        favorites: favCountRes.count ?? 0,
        searchHistory: searchCountRes.count ?? 0,
      },
      latestAccountRequest: reqRes.data?.[0] ?? null,
      loginActivity: sessionsRes.data ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load user settings.";
    await recordErrorLog(
      {
        level: "error",
        source: "User",
        route: "/api/user/settings",
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

  const parsed = userSettingsMutationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid settings input." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient(true);
  const input = parsed.data;

  try {
    if (input.action === "update_profile") {
      const { error } = await supabase
        .from("users")
        .update({
          firstname: maybeEncryptPii(input.firstname),
          lastname: maybeEncryptPii(input.lastname),
          name_index: nameBlindIndex(input.firstname, input.lastname),
          gender: input.gender ? maybeEncryptPii(input.gender) : null,
          phone_number: input.phone_number ? maybeEncryptPii(input.phone_number) : null,
          phone_index: input.phone_number ? phoneBlindIndex(input.phone_number) : null,
          city: input.city ? maybeEncryptPii(input.city) : null,
          province: input.province ? maybeEncryptPii(input.province) : null,
          school: input.school ? maybeEncryptPii(input.school) : null,
          occupation: input.occupation ? maybeEncryptPii(input.occupation) : null,
        })
        .eq("id", session.userId);

      if (error) throw error;
    } else if (input.action === "change_password") {
      const { data: user } = await supabase
        .from("users")
        .select("password")
        .eq("id", session.userId)
        .single();

      if (!user || !(await bcrypt.compare(input.current_password, String(user.password)))) {
        return NextResponse.json(
          { ok: false, error: "Current password is incorrect." },
          { status: 403 }
        );
      }

      const hashed = await bcrypt.hash(input.new_password, 12);
      const { error } = await supabase
        .from("users")
        .update({
          password: hashed,
          failed_attempts: 0,
          is_locked: false,
          lock_until: null,
        })
        .eq("id", session.userId);
      if (error) throw error;
    } else if (input.action === "toggle_security") {
      const col = input.method === "otp" ? "otp_enabled" : "pin_enabled";
      const { error } = await supabase
        .from("users")
        .update({ [col]: input.enabled })
        .eq("id", session.userId);
      if (error) throw error;
    } else if (input.action === "submit_account_request") {
      const { data: existingPending } = await supabase
        .from("account_requests")
        .select("id")
        .eq("user_id", session.userId)
        .eq("status", "pending")
        .in("request_type", ["deactivate", "delete"])
        .limit(1);

      if (existingPending && existingPending.length > 0) {
        return NextResponse.json(
          { ok: false, error: "You already have a pending account request under review." },
          { status: 409 }
        );
      }

      const { error } = await supabase.from("account_requests").insert({
        user_id: session.userId,
        username: session.email,
        request_type: input.request_type,
        reason: input.reason,
        status: "pending",
      });
      if (error) throw error;
    } else if (input.action === "clear_search_history") {
      const { error } = await supabase
        .from("user_search_history")
        .delete()
        .eq("user_id", session.userId);
      if (error) throw error;
    } else if (input.action === "clear_favorites") {
      const { error } = await supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", session.userId);
      if (error) throw error;
    }

    await recordAuditEvent(
      {
        action: input.action,
        resource: "user_settings",
        targetId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        route: "/api/user/settings",
        method: "PUT",
      },
      supabase
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update settings.";
    await recordErrorLog(
      {
        level: "error",
        source: "User",
        route: "/api/user/settings",
        method: "PUT",
        status_code: 500,
        message,
        user_email: session.email,
      },
      supabase
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
