import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";

const ALLOWED_RESOURCES = new Set([
  "inventory",
  "books",
  "library_cards",
  "returns",
  "users",
  "librarians",
  "admins",
  "account_requests",
  "events",
  "announcements",
  "system_settings",
  "backup_logs",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource") || "";

  if (!ALLOWED_RESOURCES.has(resource)) {
    return NextResponse.json({ error: "Invalid resource parameter" }, { status: 400 });
  }

  // Require authenticated staff session for sensitive admin resources
  const publicResources = new Set(["events", "announcements"]);
  if (!publicResources.has(resource)) {
    const session = await getServerSession();
    if (!session || (session.role !== "admin" && session.role !== "librarian")) {
      return NextResponse.json({ error: "Unauthorized — please log in as staff." }, { status: 401 });
    }
  }

  if (!getSupabaseSecretKey()) {
    return NextResponse.json({ error: "SUPABASE_SECRET_KEY is not configured." }, { status: 503 });
  }

  try {
    const supabase = createSupabaseServerClient(true);

    switch (resource) {
      case "inventory": {
        const { data, error } = await supabase
          .from("book_inventory")
          .select("id, book_id, volumes, available_copies, damaged_copies, lost_copies, shelf_location, status, created_at")
          .order("id", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ rows: data ?? [] });
      }
      case "books": {
        const { data, error } = await supabase
          .from("books")
          .select("id, call_number, title, author, isbn, edition, page_count, published_date, is_borrowable, api_source, created_at")
          .order("id", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ rows: data ?? [] });
      }
      case "library_cards": {
        const { data, error } = await supabase
          .from("library_cards")
          .select("id, card_type_category, user_id, card_type, date_issued, date_return, valid_until, renewal1_checked, renewal2_checked, created_at")
          .order("id", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ rows: data ?? [] });
      }
      case "returns": {
        const { data, error } = await supabase
          .from("book_return_items")
          .select("id, return_id, card_book_id, book_title, book_author, book_isbn, qty_returned")
          .order("id", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ rows: data ?? [] });
      }
      case "users":
      case "librarians":
      case "admins": {
        const roleFilter =
          resource === "users" ? "user" : resource === "librarians" ? "librarian" : "admin";
        const { data, error } = await supabase
          .from("users")
          .select("id, username, role, status, is_active, is_approved, is_locked, last_seen, created_at")
          .eq("role", roleFilter)
          .order("id", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ rows: data ?? [] });
      }
      case "account_requests": {
        const { data, error } = await supabase
          .from("account_requests")
          .select("id, user_id, request_type, reason, status, admin_note, created_at, reviewed_at")
          .order("id", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ rows: data ?? [] });
      }
      case "events": {
        const { data, error } = await supabase
          .from("events")
          .select("id, title, description, event_date, start_time, end_time, location, category")
          .order("event_date", { ascending: true });
        if (error) throw error;
        return NextResponse.json({ rows: data ?? [] });
      }
      case "announcements": {
        const { data, error } = await supabase
          .from("announcements")
          .select("id, title, body, category, pinned, author, created_at")
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ rows: data ?? [] });
      }
      case "system_settings": {
        const [settingsRes, logsRes] = await Promise.all([
          supabase.from("system_settings").select("*").limit(1),
          supabase.from("backup_logs").select("*").order("created_at", { ascending: false }).limit(10),
        ]);
        if (settingsRes.error) throw settingsRes.error;
        return NextResponse.json({
          settings: settingsRes.data?.[0] ?? null,
          backupLogs: logsRes.data ?? [],
        });
      }
      default:
        return NextResponse.json({ rows: [] });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
