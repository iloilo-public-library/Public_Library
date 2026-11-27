import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import {
  formatManilaDayLabel,
  getManilaLastNDays,
  mapDatabaseError,
  toManilaDateKey,
} from "@/lib/errors";
import { STAFF_ROLES } from "@/config/constants";

export async function queryDashboardStats(
  supabase: SupabaseClient,
  actorId: number,
  sessionToken?: string | null
) {
  // Repository-level RBAC check for staff access
  const actor = await verifyRepositoryActor(supabase, actorId, STAFF_ROLES, sessionToken);
  const isLibrarian = actor.role === "librarian";

  const manilaDays = getManilaLastNDays(7);
  const sevenDaysAgoKey = manilaDays[0] ?? toManilaDateKey();
  const todayManilaKey = manilaDays[manilaDays.length - 1] ?? toManilaDateKey();

  let pendingReqQuery = supabase
    .from("account_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (isLibrarian) {
    pendingReqQuery = pendingReqQuery.eq("request_type", "renew");
  }

  const [
    booksRes,
    invRes,
    cardsRes,
    borrowedRes,
    returnsRes,
    usersRes,
    pendingReqRes,
  ] = await Promise.all([
    supabase.from("books").select("id, created_at"),
    supabase
      .from("book_inventory")
      .select("volumes, available_copies, damaged_copies, lost_copies"),
    supabase.from("library_cards").select("id, date_return"),
    supabase.from("library_card_books").select("card_id, quantity, loan_status"),
    supabase.from("book_returns").select("id, card_id"),
    isLibrarian
      ? supabase.from("users").select("id, role").eq("role", "user")
      : supabase
          .from("users")
          .select("id, role, status, is_active, is_approved, is_locked, last_seen"),
    pendingReqQuery,
  ]);

  if (booksRes.error) throw mapDatabaseError(booksRes.error, "Failed to load catalog counts.");
  if (invRes.error) throw mapDatabaseError(invRes.error, "Failed to load inventory counts.");
  if (usersRes.error) throw mapDatabaseError(usersRes.error, "Failed to load user counts.");

  const books = (booksRes.data ?? []) as { id: number; created_at: string }[];
  const invRows = (invRes.data ?? []) as {
    volumes: number;
    available_copies: number;
    damaged_copies: number;
    lost_copies: number;
  }[];
  const cards = (cardsRes.data ?? []) as { id: number; date_return: string | null }[];
  const borrowedRows = (borrowedRes.data ?? []) as {
    card_id: number;
    quantity: number;
    loan_status?: string | null;
  }[];
  const returnRows = (returnsRes.data ?? []) as { id: number; card_id: number }[];
  const users = (usersRes.data ?? []) as {
    id: number;
    role: "admin" | "librarian" | "user";
    status: string;
    is_active: boolean;
    is_approved: boolean;
    is_locked: boolean;
    last_seen: string | null;
  }[];

  const totalVolumes = invRows.reduce((s, r) => s + (r.volumes ?? 0), 0);
  const availableCopies = invRows.reduce((s, r) => s + (r.available_copies ?? 0), 0);
  const damagedBooks = invRows.reduce((s, r) => s + (r.damaged_copies ?? 0), 0);
  const lostBooks = invRows.reduce((s, r) => s + (r.lost_copies ?? 0), 0);
  const borrowedBooks = borrowedRows
    .filter((r) => !r.loan_status || r.loan_status === "borrowed" || r.loan_status === "overdue")
    .reduce((s, r) => s + (r.quantity ?? 0), 0);

  const returnedCardIds = new Set(returnRows.map((r) => r.card_id));
  const borrowedCardIds = new Set(
    borrowedRows
      .filter((r) => !r.loan_status || r.loan_status === "borrowed" || r.loan_status === "overdue")
      .map((b) => b.card_id)
  );
  const overdueBooks = cards.filter(
    (c) =>
      borrowedCardIds.has(c.id) &&
      !returnedCardIds.has(c.id) &&
      c.date_return !== null &&
      c.date_return < todayManilaKey
  ).length;

  const roles = { admin: 0, librarian: 0, user: 0 };
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  let onlineUsers = 0;
  let offlineUsers = 0;
  let lockedUsers = 0;
  let approvedUsers = 0;

  for (const u of users) {
    if (u.role === "admin" || u.role === "librarian" || u.role === "user") {
      roles[u.role] += 1;
    }
    if (u.is_locked) lockedUsers += 1;
    if (u.is_approved) approvedUsers += 1;

    const lastSeenMs = u.last_seen ? Date.parse(u.last_seen) : 0;
    // Match legacy-flask/routes/admin_routes.py line 511: active if last_seen within 5 minutes (or active with recent session)
    const isOnline =
      (Number.isFinite(lastSeenMs) && lastSeenMs >= fiveMinAgo) ||
      (!u.last_seen && u.status === "active");

    if (isOnline) {
      onlineUsers += 1;
    } else {
      offlineUsers += 1;
    }
  }

  // 7-day book additions chart series computed in Asia/Manila (UTC+8)
  const dayBuckets = new Map<string, number>();
  for (const dayKey of manilaDays) {
    dayBuckets.set(dayKey, 0);
  }
  for (const b of books) {
    if (!b.created_at) continue;
    const dayKey = toManilaDateKey(b.created_at);
    if (dayKey >= sevenDaysAgoKey && dayBuckets.has(dayKey)) {
      dayBuckets.set(dayKey, (dayBuckets.get(dayKey) ?? 0) + 1);
    }
  }

  const booksPerDay = Array.from(dayBuckets.entries()).map(([manilaIso, count]) => ({
    label: formatManilaDayLabel(manilaIso),
    count,
  }));

  if (isLibrarian) {
    return {
      total_books: books.length,
      total_volumes: totalVolumes,
      available_books: availableCopies,
      borrowed_books: borrowedBooks,
      damaged_books: damagedBooks,
      lost_books: lostBooks,
      overdue_books: overdueBooks,
      total_users: roles.user,
      pending_requests: pendingReqRes.count ?? 0,
      active_cards: cards.length,
      total_returns: returnRows.length,
      books_per_day: booksPerDay,
      source: "supabase",
    };
  }

  return {
    total_books: books.length,
    total_volumes: totalVolumes,
    available_books: availableCopies,
    borrowed_books: borrowedBooks,
    damaged_books: damagedBooks,
    lost_books: lostBooks,
    overdue_books: overdueBooks,
    total_users: roles.user,
    total_librarians: roles.librarian,
    total_admins: roles.admin,
    online_users: onlineUsers,
    offline_users: offlineUsers,
    locked_users: lockedUsers,
    approved_users: approvedUsers,
    pending_requests: pendingReqRes.count ?? 0,
    active_cards: cards.length,
    total_returns: returnRows.length,
    roles,
    status: {
      active: onlineUsers,
      offline: offlineUsers,
      locked: lockedUsers,
    },
    books_per_day: booksPerDay,
    source: "supabase",
  };
}

export async function queryStaffAppearance(
  supabase: SupabaseClient,
  userId: number,
  sessionToken?: string | null
): Promise<{ theme: string; language: string; updated_at: string | null }> {
  await verifyRepositoryActor(supabase, userId, STAFF_ROLES, sessionToken);

  const prefRes = await supabase
    .from("user_preferences")
    .select("theme, language, updated_at")
    .eq("user_id", userId)
    .limit(1);

  if (!prefRes.error && prefRes.data && prefRes.data.length > 0) {
    const row = prefRes.data[0];
    return {
      theme: String(row.theme || "default"),
      language: String(row.language || "english"),
      updated_at: row.updated_at ? String(row.updated_at) : null,
    };
  }

  const legacyRes = await supabase
    .from("staff_appearance")
    .select("theme, language, updated_at")
    .eq("user_id", userId)
    .limit(1);

  const row = !legacyRes.error ? legacyRes.data?.[0] : null;
  return {
    theme: row?.theme ? String(row.theme) : "default",
    language: row?.language ? String(row.language) : "english",
    updated_at: row?.updated_at ? String(row.updated_at) : null,
  };
}

export async function upsertStaffAppearance(
  supabase: SupabaseClient,
  userId: number,
  input: { theme: string; language: string },
  sessionToken?: string | null
): Promise<{ theme: string; language: string }> {
  await verifyRepositoryActor(supabase, userId, STAFF_ROLES, sessionToken);

  const payload = {
    user_id: userId,
    theme: input.theme,
    language: input.language,
    updated_at: new Date().toISOString(),
  };

  const { error: prefErr } = await supabase
    .from("user_preferences")
    .upsert(payload, { onConflict: "user_id" });

  const { error: legacyErr } = await supabase
    .from("staff_appearance")
    .upsert(payload, { onConflict: "user_id" });

  if (prefErr && legacyErr) {
    throw mapDatabaseError(prefErr, "Failed to save staff appearance.");
  }

  return { theme: input.theme, language: input.language };
}
