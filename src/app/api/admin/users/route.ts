import { NextResponse } from "next/server";
import { emailBlindIndex, getServerSession } from "@/lib/auth/session";
import { isStaffRole, touchSessionActivity } from "@/lib/auth/rbac";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { safeDecryptPii } from "@/lib/crypto/fernet";
import { computeOnlineStatus, formatFullName, resolveEmail } from "@/repositories/shared";
import { adminUsersQuerySchema } from "@/validators/admin";

function formatUserRow(u: Record<string, unknown>, isAdmin = false) {
  const firstname = safeDecryptPii(u.firstname);
  const lastname = safeDecryptPii(u.lastname);
  const city = safeDecryptPii(u.city);
  const province = safeDecryptPii(u.province);
  const address = [city, province].filter(Boolean).join(", ");
  const email = resolveEmail(u.email_display, u.username);
  const hasValidId = Boolean(u.valid_id_path && safeDecryptPii(u.valid_id_path));

  return {
    id: u.id,
    email,
    username: email,
    firstname,
    lastname,
    fullname: formatFullName(u.firstname, u.lastname),
    age: safeDecryptPii(u.age),
    gender: safeDecryptPii(u.gender),
    phone_number: safeDecryptPii(u.phone_number),
    school: safeDecryptPii(u.school),
    city,
    province,
    address,
    education_level: safeDecryptPii(u.education_level),
    occupation: safeDecryptPii(u.occupation),
    is_government: Boolean(u.is_government),
    office_phone: safeDecryptPii(u.office_phone),
    role: u.role,
    status: computeOnlineStatus(u.status, u.last_seen),
    is_active: u.is_active !== undefined ? Boolean(u.is_active) : true,
    is_approved: Boolean(u.is_approved),
    is_locked: Boolean(u.is_locked),
    failed_attempts: Number(u.failed_attempts ?? 0),
    lock_until: u.lock_until ?? null,
    otp_enabled: Boolean(u.otp_enabled),
    pin_enabled: Boolean(u.pin_enabled),
    valid_id_url: isAdmin && hasValidId ? `/api/admin/valid-id/${u.id}` : "",
    created_at: u.created_at,
    last_seen: u.last_seen,
  };
}

function matchesDecryptedUserQuery(u: Record<string, unknown>, qLower: string): boolean {
  if (!qLower) return true;
  const fn = safeDecryptPii(u.firstname).toLowerCase();
  const ln = safeDecryptPii(u.lastname).toLowerCase();
  const full = `${fn} ${ln}`.trim();
  const email = resolveEmail(u.email_display, u.username).toLowerCase();
  const phone = safeDecryptPii(u.phone_number).toLowerCase();
  return (
    fn.includes(qLower) ||
    ln.includes(qLower) ||
    full.includes(qLower) ||
    email.includes(qLower) ||
    phone.includes(qLower)
  );
}

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — staff access required." },
      { status: session ? 403 : 401 }
    );
  }
  void touchSessionActivity(session);

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
    page: url.searchParams.get("page") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid query parameters." },
      { status: 400 }
    );
  }

  const isAdmin = session.role === "admin";
  const isPickerMode = parsed.data.mode === "picker" || parsed.data.role === "member";
  const effectiveLimit = isPickerMode
    ? Math.min(parsed.data.limit ?? 8, 25)
    : (parsed.data.limit ?? 25);

  const supabase = createSupabaseServerClient(true);
  const selectCols =
    "id, username, email_display, firstname, lastname, age, gender, phone_number, school, city, province, education_level, occupation, is_government, office_phone, valid_id_path, role, status, is_active, is_approved, is_locked, failed_attempts, lock_until, otp_enabled, pin_enabled, created_at, last_seen";

  try {
    // Single user detail lookup (?id=123 — matches legacy /api/admin/user/<int:user_id>)
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

      return NextResponse.json({ ok: true, user: formatUserRow(user, isAdmin) });
    }

    // Minimal member picker mode (?role=member&q=...&limit=8 or ?mode=picker)
    if (isPickerMode) {
      const q = parsed.data.q.trim();
      const qLower = q.toLowerCase();

      let pickerQuery = supabase
        .from("users")
        .select("id, username, email_display, firstname, lastname, phone_number, is_active, is_approved")
        .eq("role", "user")
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("id", { ascending: false });

      if (q) {
        const safeQ = q.replace(/[%_,()"]/g, "");
        const blindEmail = emailBlindIndex(q);
        const orClauses = [
          `firstname.ilike.%${safeQ}%`,
          `lastname.ilike.%${safeQ}%`,
          `email_display.ilike.%${safeQ}%`,
        ];
        if (blindEmail) {
          orClauses.push(`username.eq.${blindEmail}`);
        }
        if (safeQ) {
          pickerQuery = pickerQuery.or(orClauses.join(","));
        }
      }

      let { data: memberRows, error: memberErr } = await pickerQuery.limit(effectiveLimit);
      if (memberErr) throw memberErr;

      // Fallback for Fernet-encrypted rows (matches legacy helpers.py Step 4 partial decrypt fallback)
      if (q && (!memberRows || memberRows.length === 0)) {
        const { data: fallbackPool } = await supabase
          .from("users")
          .select("id, username, email_display, firstname, lastname, phone_number, is_active, is_approved")
          .eq("role", "user")
          .eq("is_active", true)
          .eq("is_approved", true)
          .order("id", { ascending: false })
          .limit(200);
        memberRows = (fallbackPool ?? [])
          .filter((r) => matchesDecryptedUserQuery(r, qLower))
          .slice(0, effectiveLimit);
      }

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
        firstname: safeDecryptPii(u.firstname),
        lastname: safeDecryptPii(u.lastname),
        fullname: formatFullName(u.firstname, u.lastname),
        is_active: Boolean(u.is_active),
        is_approved: Boolean(u.is_approved),
        library_card_number: cardMap.get(Number(u.id)) ?? null,
      }));

      return NextResponse.json({ ok: true, users, count: users.length });
    }

    // Search users/members (?q=...&role=...&limit=... — matches /api/users/search & /api/members/search)
    let query = supabase.from("users").select(selectCols).order("id", { ascending: false });

    const effectiveRole = session.role === "librarian" ? "user" : parsed.data.role;
    if (effectiveRole !== "all") {
      query = query.eq("role", effectiveRole);
    }

    const q = parsed.data.q.trim();
    const qLower = q.toLowerCase();
    if (q) {
      const safeQ = q.replace(/[%_,()"]/g, "");
      const blindEmail = emailBlindIndex(q);
      if (safeQ) {
        const orClauses = [
          `firstname.ilike.%${safeQ}%`,
          `lastname.ilike.%${safeQ}%`,
          `email_display.ilike.%${safeQ}%`,
          `username.ilike.%${safeQ}%`,
          `phone_number.ilike.%${safeQ}%`,
        ];
        if (blindEmail) {
          orClauses.push(`username.eq.${blindEmail}`);
        }
        query = query.or(orClauses.join(","));
      }
    }

    let { data, error } = await query.limit(effectiveLimit);
    if (error) throw error;

    // Fallback for Fernet-encrypted rows (matches legacy helpers.py Step 4 partial decrypt fallback)
    if (q && (!data || data.length === 0)) {
      let fbQuery = supabase.from("users").select(selectCols).order("id", { ascending: false });
      if (effectiveRole !== "all") {
        fbQuery = fbQuery.eq("role", effectiveRole);
      }
      const { data: fbPool } = await fbQuery.limit(200);
      data = (fbPool ?? [])
        .filter((u) => matchesDecryptedUserQuery(u, qLower))
        .slice(0, effectiveLimit);
    }

    const users = (data ?? []).map((u) => formatUserRow(u, isAdmin));
    return NextResponse.json({ ok: true, users, count: users.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to query users.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
