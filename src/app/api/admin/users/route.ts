import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { safeDecryptPii } from "@/lib/crypto/fernet";
import { computeOnlineStatus, formatFullName, resolveEmail } from "@/repositories/shared";
import { adminUsersQuerySchema } from "@/validators/admin";

function isStaffRole(role: string | undefined): boolean {
  return role === "admin" || role === "librarian";
}

function formatUserRow(u: Record<string, unknown>) {
  const firstname = safeDecryptPii(u.firstname);
  const lastname = safeDecryptPii(u.lastname);
  return {
    id: u.id,
    email: resolveEmail(u.email_display, u.username),
    firstname,
    lastname,
    fullname: formatFullName(u.firstname, u.lastname),
    age: safeDecryptPii(u.age),
    gender: safeDecryptPii(u.gender),
    phone_number: safeDecryptPii(u.phone_number),
    school: safeDecryptPii(u.school),
    city: safeDecryptPii(u.city),
    province: safeDecryptPii(u.province),
    education_level: safeDecryptPii(u.education_level),
    occupation: safeDecryptPii(u.occupation),
    is_government: Boolean(u.is_government),
    office_phone: safeDecryptPii(u.office_phone),
    role: u.role,
    status: computeOnlineStatus(u.status, u.last_seen),
    is_active: Boolean(u.is_active),
    is_approved: Boolean(u.is_approved),
    is_locked: Boolean(u.is_locked),
    created_at: u.created_at,
    last_seen: u.last_seen,
  };
}

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const parsed = adminUsersQuerySchema.safeParse({
    id: url.searchParams.get("id") || undefined,
    q: url.searchParams.get("q") || "",
    role: url.searchParams.get("role") || "all",
    mode: url.searchParams.get("mode") || "full",
    limit: url.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid query parameters." },
      { status: 400 }
    );
  }

  const isPickerMode = parsed.data.mode === "picker" || parsed.data.role === "member";
  const effectiveLimit = isPickerMode
    ? Math.min(parsed.data.limit ?? 8, 25)
    : (parsed.data.limit ?? 25);

  const supabase = createSupabaseServerClient(true);
  const selectCols =
    "id, username, email_display, firstname, lastname, age, gender, phone_number, school, city, province, education_level, occupation, is_government, office_phone, role, status, is_active, is_approved, is_locked, created_at, last_seen";

  try {
    // Single user detail lookup (?id=123)
    if (parsed.data.id) {
      const { data: user, error } = await supabase
        .from("users")
        .select(selectCols)
        .eq("id", parsed.data.id)
        .single();

      if (error || !user) {
        return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
      }
      // Librarians may only view patron (user) accounts
      if (session.role === "librarian" && user.role !== "user") {
        return NextResponse.json(
          { ok: false, error: "Forbidden — librarians can only inspect patron accounts." },
          { status: 403 }
        );
      }

      return NextResponse.json({ ok: true, user: formatUserRow(user) });
    }

    // Minimal member picker mode (?role=member&q=...&limit=8 or ?mode=picker)
    if (isPickerMode) {
      let pickerQuery = supabase
        .from("users")
        .select("id, firstname, lastname")
        .eq("role", "user")
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("id", { ascending: false });

      const q = parsed.data.q.trim();
      if (q) {
        const safeQ = q.replace(/[%_,()]/g, "");
        if (safeQ) {
          pickerQuery = pickerQuery.or(
            `firstname.ilike.%${safeQ}%,lastname.ilike.%${safeQ}%`
          );
        }
      }

      const { data: memberRows, error: memberErr } = await pickerQuery.limit(effectiveLimit);
      if (memberErr) throw memberErr;

      const rows = memberRows ?? [];
      const memberIds = rows.map((r) => Number(r.id));
      const cardMap = new Map<number, string>();

      if (memberIds.length > 0) {
        const { data: cardRows } = await supabase
          .from("library_cards")
          .select("id, user_id")
          .in("user_id", memberIds)
          .order("id", { ascending: false });

        for (const c of cardRows ?? []) {
          const uid = Number(c.user_id);
          if (!cardMap.has(uid)) {
            cardMap.set(uid, `LC-${String(c.id).padStart(6, "0")}`);
          }
        }
      }

      const users = rows.map((u) => ({
        id: Number(u.id),
        fullname: formatFullName(u.firstname, u.lastname),
        library_card_number: cardMap.get(Number(u.id)) ?? null,
      }));

      return NextResponse.json({ ok: true, users, count: users.length });
    }

    // Search users/members (?q=...&role=...&limit=...)
    let query = supabase.from("users").select(selectCols).order("id", { ascending: false });

    const effectiveRole = session.role === "librarian" ? "user" : parsed.data.role;
    if (effectiveRole !== "all") {
      query = query.eq("role", effectiveRole);
    }

    const q = parsed.data.q.trim();
    if (q) {
      const safeQ = q.replace(/[%_,()]/g, "");
      if (safeQ) {
        query = query.or(
          `firstname.ilike.%${safeQ}%,lastname.ilike.%${safeQ}%,email_display.ilike.%${safeQ}%,username.ilike.%${safeQ}%,phone_number.ilike.%${safeQ}%`
        );
      }
    }

    const { data, error } = await query.limit(effectiveLimit);
    if (error) throw error;

    const users = (data ?? []).map((u) => formatUserRow(u));
    return NextResponse.json({ ok: true, users, count: users.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to query users.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
