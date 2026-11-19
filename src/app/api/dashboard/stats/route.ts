import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient(true);

    const [booksRes, invRes, borrowedRes, usersRes, pendingReqRes] = await Promise.all([
      supabase.from("books").select("id", { count: "exact", head: true }),
      supabase.from("book_inventory").select("volumes, available_copies"),
      supabase.from("library_card_books").select("quantity"),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "user"),
      supabase
        .from("account_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    const invRows = (invRes.data ?? []) as { volumes: number; available_copies: number }[];
    const availableCopies = invRows.reduce((s, r) => s + (r.available_copies ?? 0), 0);

    const borrowedRows = (borrowedRes.data ?? []) as { quantity: number }[];
    const borrowedBooks = borrowedRows.reduce((s, r) => s + (r.quantity ?? 0), 0);

    return NextResponse.json({
      total_books: booksRes.count ?? 0,
      available_books: availableCopies,
      borrowed_books: borrowedBooks,
      overdue_books: 0,
      total_users: usersRes.count ?? 0,
      pending_requests: pendingReqRes.count ?? 0,
      source: "supabase",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
