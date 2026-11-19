import type { SupabaseClient } from "@supabase/supabase-js";
import {
  safeDecryptData,
  safeDecryptEmail,
  safeDecryptPii,
} from "@/lib/crypto/fernet";
import { listErrorLogs } from "@/lib/admin/error-logger";

function formatFullName(firstname: unknown, lastname: unknown): string {
  const fn = safeDecryptPii(firstname);
  const ln = safeDecryptPii(lastname);
  if (fn.startsWith("gAAAAAB")) return fn;
  if (ln.startsWith("gAAAAAB")) return ln;
  return `${fn} ${ln}`.trim() || "—";
}

function resolveEmail(emailDisplay: unknown, username: unknown): string {
  const disp = safeDecryptEmail(emailDisplay);
  if (disp && !disp.startsWith("gAAAAAB")) return disp;
  const userDec = safeDecryptEmail(username);
  if (userDec && !userDec.startsWith("gAAAAAB")) return userDec;
  return disp || String(username ?? "");
}

function computeOnlineStatus(rawStatus: unknown, lastSeen: unknown): string {
  if (!lastSeen) return String(rawStatus ?? "offline");
  const ts = Date.parse(String(lastSeen));
  if (Number.isNaN(ts)) return String(rawStatus ?? "offline");
  if (Date.now() - ts > 5 * 60 * 1000) return "offline";
  return String(rawStatus ?? "active");
}

export async function queryAdminResource(
  supabase: SupabaseClient,
  resource: string,
  sessionUserId: number | null
) {
  switch (resource) {
    case "inventory": {
      const [invRes, booksRes] = await Promise.all([
        supabase
          .from("book_inventory")
          .select(
            "id, book_id, volumes, available_copies, damaged_copies, lost_copies, shelf_location, status, created_at"
          )
          .order("id", { ascending: false }),
        supabase
          .from("books")
          .select("id, call_number, title, author, isbn, is_borrowable"),
      ]);
      if (invRes.error) throw invRes.error;
      const bookMap = new Map<
        number,
        {
          call_number: string | null;
          title: string | null;
          author: string | null;
          isbn: string | null;
          is_borrowable: boolean;
        }
      >();
      for (const b of booksRes.data ?? []) {
        bookMap.set(b.id as number, b);
      }
      const rows = (invRes.data ?? []).map((inv) => {
        const b = bookMap.get(inv.book_id as number);
        return {
          ...inv,
          book_title: b ? safeDecryptData(b.title) : `Book #${inv.book_id}`,
          book_author: b ? safeDecryptData(b.author) : "—",
          call_number: b?.call_number ?? "",
          isbn: b ? safeDecryptData(b.isbn) : "",
          is_borrowable: b?.is_borrowable ?? true,
        };
      });
      return { rows };
    }

    case "books": {
      const [booksRes, invRes] = await Promise.all([
        supabase
          .from("books")
          .select(
            "id, call_number, date_received, class, author, title, isbn, edition, page_count, category, source_of_fund, cost_price, publisher, copy_right, subtitle, published_date, description, language, thumbnail_url, api_source, is_borrowable, created_at, updated_at"
          )
          .order("id", { ascending: false }),
        supabase
          .from("book_inventory")
          .select(
            "book_id, volumes, available_copies, damaged_copies, lost_copies, shelf_location, status"
          ),
      ]);
      if (booksRes.error) throw booksRes.error;
      const invMap = new Map<number, Record<string, unknown>>();
      for (const inv of invRes.data ?? []) {
        invMap.set(inv.book_id as number, inv);
      }
      const rows = (booksRes.data ?? []).map((b) => {
        const inv = invMap.get(b.id as number);
        return {
          ...b,
          title: safeDecryptData(b.title),
          author: safeDecryptData(b.author),
          isbn: safeDecryptData(b.isbn),
          class: safeDecryptData(b.class),
          category: safeDecryptData(b.category),
          publisher: safeDecryptData(b.publisher),
          volumes: Number(inv?.volumes ?? 1),
          total_copies: Number(inv?.volumes ?? 1),
          available_copies: Number(inv?.available_copies ?? 1),
          damaged_copies: Number(inv?.damaged_copies ?? 0),
          lost_copies: Number(inv?.lost_copies ?? 0),
          shelf_location: String(inv?.shelf_location ?? ""),
          inventory_status: String(inv?.status ?? "Available"),
        };
      });
      return { rows };
    }

    case "library_cards": {
      const [cardsRes, cardBooksRes] = await Promise.all([
        supabase
          .from("library_cards")
          .select(
            "id, card_type_category, user_id, firstname, lastname, phone_number, address, date_issued, date_return, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date, card_type, valid_until, photo_path, registered_by, created_at"
          )
          .order("id", { ascending: false }),
        supabase
          .from("library_card_books")
          .select("id, card_id, book_id, book_title, book_author, book_isbn, quantity"),
      ]);
      if (cardsRes.error) throw cardsRes.error;
      const booksByCard = new Map<number, Record<string, unknown>[]>();
      for (const cb of cardBooksRes.data ?? []) {
        const cid = cb.card_id as number;
        const list = booksByCard.get(cid) ?? [];
        list.push(cb);
        booksByCard.set(cid, list);
      }
      const rows = (cardsRes.data ?? []).map((c) => {
        const cardBooks = booksByCard.get(c.id as number) ?? [];
        const fn = safeDecryptPii(c.firstname);
        const ln = safeDecryptPii(c.lastname);
        return {
          ...c,
          firstname: fn,
          lastname: ln,
          fullname: formatFullName(c.firstname, c.lastname),
          phone_number: safeDecryptPii(c.phone_number),
          address: safeDecryptPii(c.address),
          books: cardBooks,
          books_count: cardBooks.reduce((s, b) => s + Number(b.quantity ?? 1), 0),
        };
      });
      return { rows };
    }

    case "returns": {
      const [itemsRes, returnsRes, cardsRes] = await Promise.all([
        supabase
          .from("book_return_items")
          .select(
            "id, return_id, card_book_id, book_title, book_author, book_isbn, qty_returned"
          )
          .order("id", { ascending: false }),
        supabase
          .from("book_returns")
          .select("id, card_id, return_date, processed_by, created_at"),
        supabase
          .from("library_cards")
          .select("id, firstname, lastname, card_type_category"),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      const retMap = new Map<number, Record<string, unknown>>();
      for (const r of returnsRes.data ?? []) {
        retMap.set(r.id as number, r);
      }
      const cardMap = new Map<number, Record<string, unknown>>();
      for (const c of cardsRes.data ?? []) {
        cardMap.set(c.id as number, c);
      }
      const rows = (itemsRes.data ?? []).map((item) => {
        const ret = retMap.get(item.return_id as number);
        const card = ret ? cardMap.get(ret.card_id as number) : undefined;
        return {
          ...item,
          card_id: ret?.card_id ?? null,
          return_date: ret?.return_date ?? "",
          borrower_name: card
            ? formatFullName(card.firstname, card.lastname)
            : "—",
          card_category: card?.card_type_category ?? "—",
        };
      });
      return { rows };
    }

    case "users":
    case "librarians":
    case "admins": {
      const roleFilter =
        resource === "users" ? "user" : resource === "librarians" ? "librarian" : "admin";
      const { data, error } = await supabase
        .from("users")
        .select(
          "id, username, email_display, firstname, lastname, age, gender, phone_number, school, city, province, education_level, occupation, is_government, office_phone, valid_id_path, role, status, is_active, is_approved, is_locked, failed_attempts, lock_until, last_seen, created_at"
        )
        .eq("role", roleFilter)
        .order("id", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []).map((u) => {
        const email = resolveEmail(u.email_display, u.username);
        const fn = safeDecryptPii(u.firstname);
        const ln = safeDecryptPii(u.lastname);
        return {
          ...u,
          email,
          firstname: fn,
          lastname: ln,
          fullname: formatFullName(u.firstname, u.lastname),
          age: safeDecryptPii(u.age),
          gender: safeDecryptPii(u.gender),
          phone_number: safeDecryptPii(u.phone_number),
          school: safeDecryptPii(u.school),
          city: safeDecryptPii(u.city),
          province: safeDecryptPii(u.province),
          education_level: safeDecryptPii(u.education_level),
          occupation: safeDecryptPii(u.occupation),
          office_phone: safeDecryptPii(u.office_phone),
          valid_id_path: safeDecryptPii(u.valid_id_path),
          status: computeOnlineStatus(u.status, u.last_seen),
        };
      });
      return { rows };
    }

    case "account_requests": {
      const { data, error } = await supabase
        .from("account_requests")
        .select(
          "id, user_id, username, request_type, reason, status, admin_note, created_at, reviewed_at, card_id, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date"
        )
        .order("id", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(
        new Set((data ?? []).map((r) => r.user_id as number).filter(Boolean))
      );
      const userMap = new Map<number, Record<string, unknown>>();
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select(
            "id, username, email_display, firstname, lastname, age, gender, phone_number, school, city, province, education_level, occupation, is_government, office_phone, valid_id_path, created_at"
          )
          .in("id", userIds);
        for (const u of usersData ?? []) {
          userMap.set(u.id as number, u);
        }
      }

      const rows = (data ?? []).map((r) => {
        const u = userMap.get(r.user_id as number);
        return {
          ...r,
          email: u ? resolveEmail(u.email_display, u.username) : resolveEmail(null, r.username),
          fullname: u ? formatFullName(u.firstname, u.lastname) : "—",
          firstname: u ? safeDecryptPii(u.firstname) : "",
          lastname: u ? safeDecryptPii(u.lastname) : "",
          age: u ? safeDecryptPii(u.age) : "",
          gender: u ? safeDecryptPii(u.gender) : "",
          phone_number: u ? safeDecryptPii(u.phone_number) : "",
          school: u ? safeDecryptPii(u.school) : "",
          city: u ? safeDecryptPii(u.city) : "",
          province: u ? safeDecryptPii(u.province) : "",
          education_level: u ? safeDecryptPii(u.education_level) : "",
          occupation: u ? safeDecryptPii(u.occupation) : "",
          is_government: Boolean(u?.is_government),
          office_phone: u ? safeDecryptPii(u.office_phone) : "",
          valid_id_path: u ? safeDecryptPii(u.valid_id_path) : "",
        };
      });
      return { rows };
    }

    case "events": {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, event_date, start_time, end_time, location, category")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return { rows: data ?? [] };
    }

    case "announcements": {
      let query = supabase
        .from("announcements")
        .select("id, title, body, category, pinned, author, target_user_id, created_at")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (!sessionUserId) {
        query = query.is("target_user_id", null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return { rows: data ?? [] };
    }

    case "system_settings": {
      const [settingsRes, logsRes, errLogs] = await Promise.all([
        supabase.from("system_settings").select("*").limit(1),
        supabase
          .from("backup_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
        listErrorLogs(supabase),
      ]);
      if (settingsRes.error) throw settingsRes.error;
      return {
        settings: settingsRes.data?.[0] ?? null,
        backupLogs: logsRes.data ?? [],
        errorCount: errLogs.filter((e) => !e.resolved).length,
      };
    }

    case "error_logs": {
      const rows = await listErrorLogs(supabase);
      return { rows };
    }

    case "backup_logs": {
      const { data, error } = await supabase
        .from("backup_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return { rows: data ?? [] };
    }

    case "admin_profile": {
      if (!sessionUserId) {
        throw new Error("Unauthorized");
      }
      const [userRes, sessionsRes] = await Promise.all([
        supabase
          .from("users")
          .select(
            "id, username, email_display, firstname, lastname, gender, phone_number, role, is_active, is_approved, otp_enabled, pin_enabled, created_at, last_seen"
          )
          .eq("id", sessionUserId)
          .single(),
        supabase
          .from("login_sessions")
          .select("id, session_token, login_at, last_active_at, logout_at")
          .eq("user_id", sessionUserId)
          .order("login_at", { ascending: false })
          .limit(15),
      ]);
      if (userRes.error) throw userRes.error;
      const u = userRes.data;
      return {
        profile: {
          id: u.id,
          email: resolveEmail(u.email_display, u.username),
          firstname: safeDecryptPii(u.firstname),
          lastname: safeDecryptPii(u.lastname),
          fullname: formatFullName(u.firstname, u.lastname),
          gender: safeDecryptPii(u.gender),
          phone_number: safeDecryptPii(u.phone_number),
          role: u.role,
          is_active: u.is_active,
          is_approved: u.is_approved,
          otp_enabled: u.otp_enabled,
          pin_enabled: u.pin_enabled,
          created_at: u.created_at,
          last_seen: u.last_seen,
        },
        loginActivity: sessionsRes.data ?? [],
      };
    }

    default:
      return { rows: [] };
  }
}
