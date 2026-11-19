import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";

export async function GET() {
  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY is missing from environment variables." },
      { status: 503 }
    );
  }

  try {
    const supabase = createSupabaseServerClient(true);
    const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

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
      supabase.from("library_card_books").select("card_id, quantity"),
      supabase.from("book_returns").select("id, card_id"),
      supabase
        .from("users")
        .select("id, role, status, is_active, is_approved, is_locked, last_seen"),
      supabase
        .from("account_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    const books = (booksRes.data ?? []) as { id: number; created_at: string }[];
    const invRows = (invRes.data ?? []) as {
      volumes: number;
      available_copies: number;
      damaged_copies: number;
      lost_copies: number;
    }[];
    const cards = (cardsRes.data ?? []) as { id: number; date_return: string | null }[];
    const borrowedRows = (borrowedRes.data ?? []) as { card_id: number; quantity: number }[];
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
    const borrowedBooks = borrowedRows.reduce((s, r) => s + (r.quantity ?? 0), 0);

    const returnedCardIds = new Set(returnRows.map((r) => r.card_id));
    const borrowedCardIds = new Set(borrowedRows.map((b) => b.card_id));
    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueBooks = cards.filter(
      (c) =>
        borrowedCardIds.has(c.id) &&
        !returnedCardIds.has(c.id) &&
        c.date_return !== null &&
        c.date_return < todayStr
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
      if ((lastSeenMs && lastSeenMs >= fiveMinAgo) || u.status === "active") {
        onlineUsers += 1;
      } else {
        offlineUsers += 1;
      }
    }

    // 7-day book additions chart series
    const dayBuckets = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dayBuckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const b of books) {
      const dayKey = (b.created_at ?? "").slice(0, 10);
      if (dayKey >= sevenDaysAgo && dayBuckets.has(dayKey)) {
        dayBuckets.set(dayKey, (dayBuckets.get(dayKey) ?? 0) + 1);
      }
    }
    const booksPerDay = Array.from(dayBuckets.entries()).map(([iso, count]) => ({
      label: new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      count,
    }));

    return NextResponse.json({
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
