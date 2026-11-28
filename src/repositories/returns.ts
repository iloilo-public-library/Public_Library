import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { STAFF_ROLES } from "@/config/constants";
import { safeDecryptPii } from "@/lib/crypto/fernet";
import { mapDatabaseError } from "@/lib/errors";
import { CIRCULATION_RULES } from "@/lib/circulation/rules";
import { AdminMutationError, formatFullName } from "@/repositories/shared";
import { mutateLibraryCards } from "@/repositories/library-cards";
import { returnItemDeleteSchema } from "@/validators/admin";

export interface ReturnsQueryOptions {
  id?: number;
  page?: number;
  pageSize?: number;
  q?: string;
  from?: string;
  to?: string;
  format?: "json" | "csv";
  sort?: string;
  order?: "asc" | "desc";
  sessionRole?: string | null;
  actorId?: number | null;
  sessionToken?: string | null;
}

const MAX_PAGE_SIZE = 200;
const DB_FETCH_CAP = 2000;

export async function queryReturns(
  supabase: SupabaseClient,
  options: ReturnsQueryOptions = {}
) {
  const actor = await verifyRepositoryActor(
    supabase,
    options.actorId,
    STAFF_ROLES,
    options.sessionToken
  );
  const isCsv = options.format === "csv";
  const maxPageLimit = isCsv ? CIRCULATION_RULES.MAX_CSV_EXPORT_ROWS : MAX_PAGE_SIZE;
  const fetchCap = isCsv ? Math.max(DB_FETCH_CAP, CIRCULATION_RULES.MAX_CSV_EXPORT_ROWS) : DB_FETCH_CAP;
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.min(
    maxPageLimit,
    Math.max(1, Math.trunc(options.pageSize ?? maxPageLimit))
  );
  const q = (options.q ?? "").trim().toLowerCase();
  const fromDate = (options.from ?? "").trim();
  const toDate = (options.to ?? "").trim();
  const sortField = (options.sort ?? "id").trim().toLowerCase();
  const sortAsc = options.order === "asc";
  const isLibrarian = actor.role === "librarian";
  const cardIdFilter = options.id;

  type ReturnItemRow = {
    id: number;
    return_id: number;
    card_book_id: number | null;
    book_title: string | null;
    book_author: string | null;
    book_isbn: string | null;
    qty_returned: number;
    return_condition: string | null;
    condition_notes?: string | null;
  };

  let itemsData: ReturnItemRow[] = [];
  let returnsData: Array<Record<string, unknown>> = [];
  let cardsData: Array<Record<string, unknown>> = [];

  if (cardIdFilter !== undefined) {
    const [returnsRes, cardsRes] = await Promise.all([
      supabase
        .from("book_returns")
        .select(
          "id, card_id, return_date, processed_by, overdue_days, fine_amount, fine_paid, fine_waived, created_at"
        )
        .eq("card_id", cardIdFilter)
        .limit(DB_FETCH_CAP),
      supabase
        .from("library_cards")
        .select("id, firstname, lastname, phone_number, date_issued, card_type_category")
        .eq("id", cardIdFilter)
        .limit(1),
    ]);
    if (returnsRes.error) throw mapDatabaseError(returnsRes.error, "Failed to load return history.");
    if (cardsRes.error) throw mapDatabaseError(cardsRes.error, "Failed to load return history.");
    returnsData = (returnsRes.data ?? []) as Array<Record<string, unknown>>;
    cardsData = (cardsRes.data ?? []) as Array<Record<string, unknown>>;

    const returnIds = returnsData
      .map((r) => Number(r.id))
      .filter((rid) => Number.isInteger(rid) && rid > 0);
    if (returnIds.length > 0) {
      const itemsRes = await supabase
        .from("book_return_items")
        .select(
          "id, return_id, card_book_id, book_title, book_author, book_isbn, qty_returned, return_condition, condition_notes"
        )
        .in("return_id", returnIds)
        .order("id", { ascending: false })
        .limit(DB_FETCH_CAP);
      if (itemsRes.error) throw mapDatabaseError(itemsRes.error, "Failed to load return history.");
      itemsData = (itemsRes.data ?? []) as ReturnItemRow[];
    }
  } else {
    const [itemsRes, returnsRes, cardsRes] = await Promise.all([
      supabase
        .from("book_return_items")
        .select(
          "id, return_id, card_book_id, book_title, book_author, book_isbn, qty_returned, return_condition, condition_notes"
        )
        .order("id", { ascending: false })
        .limit(fetchCap),
      supabase
        .from("book_returns")
        .select(
          "id, card_id, return_date, processed_by, overdue_days, fine_amount, fine_paid, fine_waived, created_at"
        )
        .limit(fetchCap),
      supabase
        .from("library_cards")
        .select("id, firstname, lastname, phone_number, date_issued, card_type_category")
        .limit(fetchCap),
    ]);
    if (itemsRes.error) throw mapDatabaseError(itemsRes.error, "Failed to load return history.");
    if (returnsRes.error) throw mapDatabaseError(returnsRes.error, "Failed to load return history.");
    if (cardsRes.error) throw mapDatabaseError(cardsRes.error, "Failed to load return history.");
    itemsData = (itemsRes.data ?? []) as ReturnItemRow[];
    returnsData = (returnsRes.data ?? []) as Array<Record<string, unknown>>;
    cardsData = (cardsRes.data ?? []) as Array<Record<string, unknown>>;
  }

  const staffIds = Array.from(
    new Set(
      returnsData
        .map((r) => Number(r.processed_by))
        .filter((uid) => Number.isInteger(uid) && uid > 0)
    )
  );
  const staffMap = new Map<number, string>();
  if (staffIds.length > 0) {
    const { data: staffRows } = await supabase
      .from("users")
      .select("id, firstname, lastname")
      .in("id", staffIds);
    for (const u of staffRows ?? []) {
      staffMap.set(Number(u.id), formatFullName(u.firstname, u.lastname));
    }
  }

  const retMap = new Map<number, Record<string, unknown>>();
  for (const r of returnsData) {
    retMap.set(r.id as number, r);
  }
  const cardMap = new Map<number, Record<string, unknown>>();
  for (const c of cardsData) {
    cardMap.set(c.id as number, c);
  }

  let rows = itemsData.map((item) => {
    const ret = retMap.get(item.return_id as number);
    const card = ret ? cardMap.get(ret.card_id as number) : undefined;
    const processedById = ret?.processed_by ? Number(ret.processed_by) : 0;
    const fineWaived = Boolean(ret?.fine_waived);
    const baseRow = {
      ...item,
      card_id: ret?.card_id ?? null,
      return_date: String(ret?.return_date ?? ""),
      date_issued: String(card?.date_issued ?? ""),
      borrower_name: card ? formatFullName(card.firstname, card.lastname) : "—",
      card_category: card?.card_type_category ?? "—",
      processed_by_name: processedById ? (staffMap.get(processedById) ?? "—") : "—",
      overdue_days: Number(ret?.overdue_days ?? 0),
      fine_amount: fineWaived ? 0 : Number(ret?.fine_amount ?? 0),
      fine_waived: fineWaived,
    };
    if (isLibrarian) {
      return baseRow;
    }
    return {
      ...baseRow,
      phone_number: card ? safeDecryptPii(card.phone_number) : "",
    };
  });

  if (fromDate) {
    rows = rows.filter((r) => r.return_date >= fromDate);
  }
  if (toDate) {
    rows = rows.filter((r) => r.return_date <= toDate);
  }
  if (q) {
    rows = rows.filter((r) => {
      const hay = `${r.borrower_name} ${r.book_title ?? ""} ${r.book_author ?? ""} ${r.book_isbn ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  rows.sort((a, b) => {
    let cmp = 0;
    if (sortField === "return_date") {
      cmp = a.return_date.localeCompare(b.return_date);
    } else if (sortField === "fine_amount") {
      cmp = a.fine_amount - b.fine_amount;
    } else {
      cmp = Number(a.id) - Number(b.id);
    }
    if (cmp === 0) return Number(b.id) - Number(a.id);
    return sortAsc ? cmp : -cmp;
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export async function mutateReturns(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  if (action === "delete") {
    await verifyRepositoryActor(supabase, session.userId, ["admin"], session.sessionToken);
    const parsedDel = returnItemDeleteSchema.safeParse(payload);
    if (!parsedDel.success) {
      throw new AdminMutationError(
        parsedDel.error.issues[0]?.message || "Invalid delete payload.",
        400
      );
    }
    if (!id) throw new AdminMutationError("Return item ID is required.", 400);
    const { error } = await supabase.from("book_return_items").delete().eq("id", id);
    if (error) throw mapDatabaseError(error, "Failed to delete return item.");
    return {
      ok: true,
      deletedId: id,
      audit_details: `action=delete_return_item id=${id} actor_id=${session.userId}`,
    };
  }

  await verifyRepositoryActor(supabase, session.userId, STAFF_ROLES, session.sessionToken);

  if (action === "create") {
    const cardId = Number(payload.card_id);
    if (!cardId) throw new AdminMutationError("A valid Library Card ID is required.", 400);
    return mutateLibraryCards(supabase, session, "return_books", cardId, payload);
  }

  throw new AdminMutationError(`Unknown returns action: ${action}`, 400);
}
