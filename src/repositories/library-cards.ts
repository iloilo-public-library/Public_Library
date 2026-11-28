import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { STAFF_ROLES } from "@/config/constants";
import { safeDecryptData, safeDecryptPii } from "@/lib/crypto/fernet";
import { isbnMatches, normalizeIsbn } from "@/lib/books/isbn";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { deleteFromDropbox, isDropboxConfigured } from "@/lib/storage/dropbox";
import { DROPBOX_FOLDERS } from "@/lib/storage";
import {
  CIRCULATION_RULES,
  addDaysToIsoDate,
  computeOverdueDays,
  computeOverdueFine,
  getManilaTodayISO,
  isCardExpired,
  isIsoDate,
  isReferenceSectionBook,
  validateAndResolveDueDate,
} from "@/lib/circulation/rules";
import { loadLibraryHolidayDateSet } from "@/repositories/holidays";
import { recomputeBookInventoryCounts } from "@/repositories/inventory";
import { AdminMutationError, formatFullName } from "@/repositories/shared";
import {
  libraryCardCreateSchema,
  libraryCardDeleteSchema,
  libraryCardMarkIncidentSchema,
  libraryCardRecordFinePaymentSchema,
  libraryCardResolveReplacementSchema,
  libraryCardReturnSchema,
  libraryCardUpdateSchema,
  libraryCardWaiveFineSchema,
} from "@/validators/admin";

function isMissingColumnError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; message?: unknown };
  const code = String(e.code ?? "");
  const msg = String(e.message ?? "");
  return code === "42703" || code === "PGRST204" || /column .* does not exist/i.test(msg);
}

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; message?: unknown };
  const code = String(e.code ?? "");
  const msg = String(e.message ?? "");
  return code === "42P01" || code === "PGRST205" || /relation .* does not exist/i.test(msg);
}

/**
 * Checks whether renewing a loan is blocked by a copy reservation.
 * Blocks if any borrowed copy itself is Reserved, OR if another copy of the book
 * is Reserved AND zero Good/Fair Available copies of that book remain.
 */
export async function hasBlockingReservationForCard(
  supabase: SupabaseClient,
  cardBooks: Array<{ book_id?: unknown; copy_id?: unknown }>
): Promise<{ blocked: boolean; reason?: string }> {
  const copyIds = (cardBooks ?? []).map((cb) => Number(cb.copy_id)).filter((id) => id > 0);
  const bookIds = Array.from(
    new Set((cardBooks ?? []).map((cb) => Number(cb.book_id)).filter((id) => id > 0))
  );

  if (copyIds.length > 0) {
    const { data: reservedSelf, error } = await supabase
      .from("book_copies")
      .select("id")
      .in("id", copyIds)
      .eq("circulation_status", "Reserved")
      .limit(1);
    if (error) throw mapDatabaseError(error, "Failed to verify copy reservation status.");
    if (reservedSelf && reservedSelf.length > 0) {
      return { blocked: true, reason: "Cannot renew because this copy is reserved." };
    }
  }

  if (bookIds.length > 0) {
    const { data: bookCopies, error } = await supabase
      .from("book_copies")
      .select("id, book_id, circulation_status, condition")
      .in("book_id", bookIds);
    if (error) throw mapDatabaseError(error, "Failed to verify book reservation status.");

    for (const bid of bookIds) {
      const copies = (bookCopies ?? []).filter((c) => Number(c.book_id) === bid);
      const hasReserved = copies.some((c) => String(c.circulation_status) === "Reserved");
      if (!hasReserved) continue;
      const hasAvailable = copies.some((c) => {
        const cond = String(c.condition ?? "Good");
        return String(c.circulation_status) === "Available" && (cond === "Good" || cond === "Fair");
      });
      if (!hasAvailable) {
        return {
          blocked: true,
          reason: "Cannot renew because another patron has reserved a copy of this book and no available copies remain.",
        };
      }
    }
  }

  return { blocked: false };
}

/**
 * Computes a member's total unpaid, unwaived fine balance across stored fines,
 * partial fine payments, and live accrued overdue fines on active loans.
 */
export async function computeMemberUnpaidFineBalance(
  supabase: SupabaseClient,
  userId: number,
  todayIso: string = getManilaTodayISO(),
  options: {
    preloadedCards?: Array<Record<string, unknown>>;
    includeLiveOverdue?: boolean;
    holidayDates?: ReadonlySet<string>;
  } = {}
): Promise<{
  totalUnpaid: number;
  storedUnpaid: number;
  activeBorrowedCount: number;
  pendingReplacementCount: number;
  cards: Array<Record<string, unknown>>;
}> {
  let cards = options.preloadedCards;
  if (!cards) {
    const { data: fetchedCards, error: cardsErr } = await supabase
      .from("library_cards")
      .select("id, valid_until, date_return")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .limit(500);
    if (cardsErr) throw mapDatabaseError(cardsErr, "Failed to verify member fines.");
    cards = (fetchedCards ?? []) as Array<Record<string, unknown>>;
  }

  if (cards.length === 0) {
    return {
      totalUnpaid: 0,
      storedUnpaid: 0,
      activeBorrowedCount: 0,
      pendingReplacementCount: 0,
      cards,
    };
  }

  const holidayDates = options.holidayDates ?? (await loadLibraryHolidayDateSet(supabase));
  const cardIds = cards.map((c) => Number(c.id)).filter((id) => id > 0);
  const [activeLoansRes, returnsRes, paymentsRes] = await Promise.all([
    supabase
      .from("library_card_books")
      .select("id, card_id, quantity, loan_status, fine_amount, fine_paid, fine_waived")
      .in("card_id", cardIds),
    supabase
      .from("book_returns")
      .select("id, card_id, fine_amount, fine_paid, fine_waived")
      .in("card_id", cardIds),
    supabase
      .from("fine_payments")
      .select("id, card_id, amount_paid")
      .in("card_id", cardIds),
  ]);

  if (activeLoansRes.error) throw mapDatabaseError(activeLoansRes.error, "Failed to verify member loans.");
  if (returnsRes.error) throw mapDatabaseError(returnsRes.error, "Failed to verify member returns.");
  if (paymentsRes.error && !isMissingTableError(paymentsRes.error)) {
    throw mapDatabaseError(paymentsRes.error, "Failed to verify fine payments.");
  }

  let activeBorrowedCount = 0;
  let pendingReplacementCount = 0;
  let storedUnpaidFines = 0;
  const activeQtyByCard = new Map<number, number>();
  const booksByCardCount = new Map<number, number>();

  for (const lcb of activeLoansRes.data ?? []) {
    const cid = Number(lcb.card_id);
    booksByCardCount.set(cid, (booksByCardCount.get(cid) ?? 0) + 1);
    const status = String(lcb.loan_status ?? "borrowed");
    const isActive = status === "borrowed" || status === "overdue";
    const qty = Math.max(1, Number(lcb.quantity ?? 1) || 1);
    if (isActive) {
      activeBorrowedCount += qty;
      activeQtyByCard.set(cid, (activeQtyByCard.get(cid) ?? 0) + qty);
    }
    if (status === "replacement_pending") {
      pendingReplacementCount += qty;
    }
    const fine = Number(lcb.fine_amount ?? 0);
    if (fine > 0 && !lcb.fine_paid && !lcb.fine_waived) {
      storedUnpaidFines += fine;
    }
  }

  const returnedCardIds = new Set<number>();
  for (const ret of returnsRes.data ?? []) {
    returnedCardIds.add(Number(ret.card_id));
    const fine = Number(ret.fine_amount ?? 0);
    if (fine > 0 && !ret.fine_paid && !ret.fine_waived) {
      storedUnpaidFines += fine;
    }
  }

  const paidTotal = (paymentsRes.data ?? []).reduce(
    (s, p) => s + Number(p.amount_paid ?? 0),
    0
  );

  let liveOverdueFines = 0;
  for (const card of cards) {
    const cid = Number(card.id);
    const hasBooks = (booksByCardCount.get(cid) ?? 0) > 0;
    const activeQty = activeQtyByCard.get(cid) ?? 0;
    const cardActive = hasBooks ? activeQty > 0 : !returnedCardIds.has(cid);
    if (!cardActive) continue;
    const overdueDays = computeOverdueDays(String(card.date_return ?? ""), todayIso, holidayDates);
    if (overdueDays > 0) {
      liveOverdueFines += computeOverdueFine(overdueDays, Math.max(1, activeQty || 1));
    }
  }

  const storedUnpaid = Number(Math.max(0, storedUnpaidFines - paidTotal).toFixed(2));
  const includeLive = options.includeLiveOverdue !== false;
  const totalUnpaid = Number(
    (storedUnpaid + (includeLive ? liveOverdueFines : 0)).toFixed(2)
  );
  return {
    totalUnpaid,
    storedUnpaid,
    activeBorrowedCount,
    pendingReplacementCount,
    cards,
  };
}

/**
 * Shared atomic renewal helper used by both Staff `renew` and Member renewal request approval.
 * Re-checks card expiry, active loans, both renewal slots, overdue, unpaid fines, and
 * blocking copy reservations, advances `date_return` capped at MAX_LOAN_DAYS, and performs
 * an optimistic conditional update on `renewal1_checked` / `renewal2_checked`.
 */
export async function renewLibraryCardAtomically(
  supabase: SupabaseClient,
  cardId: number,
  todayIso: string = getManilaTodayISO()
): Promise<{
  ok: true;
  id: number;
  date_return: string;
  renewal1_checked: boolean;
  renewal1_date: string | null;
  renewal2_checked: boolean;
  renewal2_date: string | null;
}> {
  const { data: existingCard, error: cardErr } = await supabase
    .from("library_cards")
    .select(
      "id, user_id, card_type_category, date_issued, date_return, valid_until, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date"
    )
    .eq("id", cardId)
    .maybeSingle();

  if (cardErr) throw mapDatabaseError(cardErr, "Failed to load library card.");
  if (!existingCard) {
    throw new AdminMutationError("Card not found.", 404);
  }

  if (isCardExpired(existingCard.valid_until, todayIso)) {
    throw new AdminMutationError("Cannot renew an expired library card.", 400);
  }

  const holidayDates = await loadLibraryHolidayDateSet(supabase);

  const { data: cardBooksForCheck, error: cbErr } = await supabase
    .from("library_card_books")
    .select("book_id, copy_id, loan_status")
    .eq("card_id", cardId);
  if (cbErr) throw mapDatabaseError(cbErr, "Failed to check loan items.");

  if (cardBooksForCheck && cardBooksForCheck.length > 0) {
    const hasReplacementPending = cardBooksForCheck.some(
      (cb) => cb.loan_status === "replacement_pending"
    );
    if (hasReplacementPending) {
      throw new AdminMutationError(
        "Cannot renew while a book on this card has a pending replacement.",
        409
      );
    }
    const hasActive = cardBooksForCheck.some(
      (cb) => cb.loan_status === "borrowed" || cb.loan_status === "overdue"
    );
    if (!hasActive) {
      throw new AdminMutationError("Cannot renew a loan that has already been returned or closed.", 409);
    }
  } else {
    const { data: existingReturn } = await supabase
      .from("book_returns")
      .select("id")
      .eq("card_id", cardId)
      .limit(1);
    if (existingReturn && existingReturn.length > 0) {
      throw new AdminMutationError("Cannot renew a loan that has already been returned.", 409);
    }
  }

  const slot1Used = Boolean(existingCard.renewal1_checked);
  const slot2Used = Boolean(existingCard.renewal2_checked);
  if (slot2Used) {
    throw new AdminMutationError(
      `Maximum renewals (${CIRCULATION_RULES.MAX_RENEWALS}) have already been used for this loan.`,
      409
    );
  }

  if (computeOverdueDays(existingCard.date_return, todayIso, holidayDates) > 0) {
    throw new AdminMutationError(
      "Cannot renew an overdue loan. Please return the book and settle any overdue fine first.",
      409
    );
  }

  if (existingCard.card_type_category === "member" && existingCard.user_id) {
    const { storedUnpaid, pendingReplacementCount } = await computeMemberUnpaidFineBalance(
      supabase,
      Number(existingCard.user_id),
      todayIso,
      { includeLiveOverdue: false, holidayDates }
    );
    if (pendingReplacementCount > 0) {
      throw new AdminMutationError(
        "Cannot renew while member has pending book replacement(s) to resolve.",
        409
      );
    }
    if (storedUnpaid >= CIRCULATION_RULES.BLOCKING_UNPAID_FINE_PHP) {
      throw new AdminMutationError(
        `Cannot renew while member has unpaid fines of PHP ${storedUnpaid.toFixed(2)}.`,
        409
      );
    }
  }

  const reserveCheck = await hasBlockingReservationForCard(supabase, cardBooksForCheck ?? []);
  if (reserveCheck.blocked) {
    throw new AdminMutationError(
      reserveCheck.reason || "Cannot renew because a copy of this book is reserved.",
      409
    );
  }

  const baseDate =
    existingCard.date_return && String(existingCard.date_return) >= todayIso
      ? String(existingCard.date_return)
      : todayIso;
  const rawNext = addDaysToIsoDate(baseDate, CIRCULATION_RULES.RENEWAL_EXTENSION_DAYS);
  const maxDue = addDaysToIsoDate(todayIso, CIRCULATION_RULES.MAX_LOAN_DAYS);
  const nextDateReturn = rawNext > maxDue ? maxDue : rawNext;

  const nextRen1Checked = true;
  const nextRen1Date = slot1Used ? (existingCard.renewal1_date as string | null) : todayIso;
  const nextRen2Checked = slot1Used;
  const nextRen2Date = slot1Used ? todayIso : (existingCard.renewal2_date as string | null);

  const { data: updatedRow, error } = await supabase
    .from("library_cards")
    .update({
      date_return: nextDateReturn,
      renewal1_checked: nextRen1Checked,
      renewal1_date: nextRen1Date,
      renewal2_checked: nextRen2Checked,
      renewal2_date: nextRen2Date,
    })
    .eq("id", cardId)
    .eq("renewal1_checked", slot1Used)
    .eq("renewal2_checked", slot2Used)
    .select("id")
    .maybeSingle();

  if (error) throw mapDatabaseError(error, "Failed to renew loan.");
  if (!updatedRow) {
    throw new AdminMutationError(
      "Loan renewal state changed concurrently. Please refresh and retry.",
      409
    );
  }

  return {
    ok: true,
    id: cardId,
    date_return: nextDateReturn,
    renewal1_checked: nextRen1Checked,
    renewal1_date: nextRen1Date,
    renewal2_checked: nextRen2Checked,
    renewal2_date: nextRen2Date,
  };
}

export interface LibraryCardsQueryOptions {
  id?: number;
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  overdue?: boolean;
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

interface BookSnapshot {
  book_id: number;
  copy_id: number | null;
  title: string;
  author: string;
  isbn: string;
  cost_price: number | null;
  is_borrowable: boolean;
  qty: number;
}

async function resolveBookIdByIsbn(
  supabase: SupabaseClient,
  rawIsbn: string
): Promise<number> {
  const normalized = normalizeIsbn(rawIsbn);
  if (!normalized) {
    throw new AdminMutationError("A valid book ID or ISBN is required.", 400);
  }
  const { data: candidates, error } = await supabase
    .from("books")
    .select("id, isbn")
    .not("isbn", "is", null)
    .limit(DB_FETCH_CAP);
  if (error) {
    throw mapDatabaseError(error, "Failed to resolve book by ISBN.");
  }
  const match = (candidates ?? []).find((b) =>
    isbnMatches(safeDecryptData(b.isbn), normalized)
  );
  if (!match) {
    throw new AdminMutationError(`No book found matching ISBN ${normalized}.`, 404);
  }
  return Number(match.id);
}

async function resolveBookSnapshots(
  supabase: SupabaseClient,
  singleBookId: number | null,
  singleCopyId: number | null,
  singleQty: number,
  rawBookIds?: unknown[],
  singleIsbn?: string | null
): Promise<BookSnapshot[]> {
  const requested: Array<{ id: number; copy_id: number | null; qty: number }> = [];

  if (Array.isArray(rawBookIds) && rawBookIds.length > 0) {
    for (const item of rawBookIds) {
      if (typeof item === "number" || typeof item === "string") {
        const bid = Number(item);
        if (Number.isInteger(bid) && bid > 0) {
          requested.push({ id: bid, copy_id: null, qty: 1 });
        }
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        let bid = Number(obj.id ?? obj.book_id ?? 0);
        if ((!Number.isInteger(bid) || bid <= 0) && typeof obj.isbn === "string" && obj.isbn.trim()) {
          bid = await resolveBookIdByIsbn(supabase, obj.isbn);
        }
        const cid = obj.copy_id ? Number(obj.copy_id) : null;
        const qty = Math.max(1, Number(obj.qty ?? obj.quantity ?? 1) || 1);
        if (Number.isInteger(bid) && bid > 0) {
          requested.push({ id: bid, copy_id: cid, qty: cid ? 1 : qty });
        }
      }
    }
  } else if (singleBookId && singleBookId > 0) {
    requested.push({
      id: singleBookId,
      copy_id: singleCopyId && singleCopyId > 0 ? singleCopyId : null,
      qty: singleCopyId ? 1 : Math.max(1, singleQty || 1),
    });
  } else if (singleIsbn && singleIsbn.trim()) {
    const resolvedId = await resolveBookIdByIsbn(supabase, singleIsbn);
    requested.push({
      id: resolvedId,
      copy_id: singleCopyId && singleCopyId > 0 ? singleCopyId : null,
      qty: singleCopyId ? 1 : Math.max(1, singleQty || 1),
    });
  }

  if (requested.length === 0) return [];

  const uniqueIds = Array.from(new Set(requested.map((r) => r.id)));
  const requestedCopyIds = Array.from(
    new Set(requested.map((r) => r.copy_id).filter((cid): cid is number => Boolean(cid && cid > 0)))
  );

  const [booksRes, invRes, copiesRes] = await Promise.all([
    supabase
      .from("books")
      .select("id, title, author, isbn, cost_price, is_borrowable, category, class")
      .in("id", uniqueIds),
    supabase
      .from("book_inventory")
      .select("book_id, shelf_location")
      .in("book_id", uniqueIds),
    requestedCopyIds.length > 0
      ? supabase.from("book_copies").select("id, shelf_location").in("id", requestedCopyIds)
      : Promise.resolve({ data: [] as Array<{ id: number; shelf_location?: unknown }>, error: null }),
  ]);

  if (booksRes.error) {
    throw mapDatabaseError(booksRes.error, "Failed to look up books.");
  }
  if (invRes.error && !isMissingTableError(invRes.error)) {
    throw mapDatabaseError(invRes.error, "Failed to look up book inventory.");
  }
  if (copiesRes.error && !isMissingTableError(copiesRes.error)) {
    throw mapDatabaseError(copiesRes.error, "Failed to look up book copy shelf locations.");
  }

  const bookMap = new Map<
    number,
    {
      id: number;
      title: unknown;
      author: unknown;
      isbn: unknown;
      cost_price?: unknown;
      is_borrowable?: unknown;
      category?: unknown;
      class?: unknown;
    }
  >();
  for (const b of booksRes.data ?? []) {
    bookMap.set(Number(b.id), b);
  }

  const invShelfByBook = new Map<number, string>();
  for (const inv of invRes.data ?? []) {
    invShelfByBook.set(Number(inv.book_id), String(inv.shelf_location ?? ""));
  }

  const copyShelfById = new Map<number, string>();
  for (const cp of copiesRes.data ?? []) {
    copyShelfById.set(Number(cp.id), String(cp.shelf_location ?? ""));
  }

  const snapshots: BookSnapshot[] = [];
  for (const req of requested) {
    const b = bookMap.get(req.id);
    if (!b) {
      throw new AdminMutationError(`Book #${req.id} was not found.`, 404);
    }
    const title = safeDecryptData(b.title);
    const category = safeDecryptData(b.category);
    const bookClass = safeDecryptData(b.class);
    const copyShelf = req.copy_id ? copyShelfById.get(req.copy_id) ?? "" : "";
    const invShelf = invShelfByBook.get(req.id) ?? "";
    const shelfLocation = copyShelf || invShelf;

    if (
      isReferenceSectionBook({
        is_borrowable: b.is_borrowable,
        category,
        class: bookClass,
        shelf_location: shelfLocation,
      })
    ) {
      throw new AdminMutationError(
        `"${title}" belongs to the Reference Section (Room Use Only) and cannot be borrowed.`,
        400
      );
    }

    const borrowable = b.is_borrowable !== false;
    snapshots.push({
      book_id: Number(b.id),
      copy_id: req.copy_id,
      title,
      author: safeDecryptData(b.author),
      isbn: safeDecryptData(b.isbn),
      cost_price: b.cost_price !== undefined && b.cost_price !== null ? Number(b.cost_price) : null,
      is_borrowable: borrowable,
      qty: req.qty,
    });
  }
  return snapshots;
}

/**
 * Atomically claims a single copy (circulation_status: Available -> Borrowed)
 * and creates the library_card_books row.
 * Uses the PostgreSQL RPC `borrow_book_copy_atomic` when available, and falls back
 * to a conditional UPDATE `.eq("circulation_status", "Available")` + INSERT.
 */
export async function claimCopyAtomically(
  supabase: SupabaseClient,
  params: {
    cardId: number;
    bookId: number;
    copyId: number;
    bookTitle: string;
    bookAuthor: string;
    bookIsbn: string;
  }
): Promise<{ copyId: number; cardBookId: number | null }> {
  // Attempt Postgres transactional RPC first if supported by client
  if (typeof supabase.rpc === "function") {
    try {
      const rpcRes = await supabase.rpc("borrow_book_copy_atomic", {
        p_card_id: params.cardId,
        p_book_id: params.bookId,
        p_copy_id: params.copyId,
        p_book_title: params.bookTitle,
        p_book_author: params.bookAuthor,
        p_book_isbn: params.bookIsbn,
      });
      if (!rpcRes.error && rpcRes.data) {
        const row = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
        if (row && row.claimed_copy_id) {
          return {
            copyId: Number(row.claimed_copy_id),
            cardBookId: row.card_book_id ? Number(row.card_book_id) : null,
          };
        }
      }
      if (rpcRes.error) {
        const msg = String(rpcRes.error.message ?? "");
        const code = String(rpcRes.error.code ?? "");
        if (code === "P0001" && /REPLACEMENT_PENDING/i.test(msg)) {
          throw new AdminMutationError(
            "Member has pending book replacement(s) blocking new borrows until resolved.",
            409
          );
        }
        if (code === "P0001" && /REFERENCE_ONLY/i.test(msg)) {
          throw new AdminMutationError(
            "Reference Section books are for room use only and cannot be borrowed.",
            400
          );
        }
        if (code === "P0001" && /BORROW_LIMIT_EXCEEDED/i.test(msg)) {
          throw new AdminMutationError(
            `Borrow limit exceeded (max ${CIRCULATION_RULES.MAX_ACTIVE_BORROWS} active books).`,
            409
          );
        }
        if (code === "P0001" || /COPY_NOT_AVAILABLE/i.test(msg)) {
          throw new AdminMutationError(
            "This book copy is no longer available for borrowing.",
            409
          );
        }
        // If function does not exist yet (42883 / PGRST202), fall back to conditional UPDATE
        if (code !== "42883" && code !== "PGRST202" && !/function .* does not exist/i.test(msg)) {
          throw mapDatabaseError(rpcRes.error, "Failed to borrow copy.");
        }
      }
    } catch (err) {
      if (err instanceof AdminMutationError || err instanceof AppError) throw err;
    }
  }

  // Conditional atomic UPDATE on book_copies.circulation_status = 'Available' & Good/Fair condition
  const { data: claimed, error: claimErr } = await supabase
    .from("book_copies")
    .update({ circulation_status: "Borrowed" })
    .eq("id", params.copyId)
    .eq("book_id", params.bookId)
    .eq("circulation_status", "Available")
    .in("condition", ["Good", "Fair"])
    .select("id")
    .maybeSingle();

  if (claimErr) {
    throw mapDatabaseError(claimErr, "Failed to reserve copy for borrowing.");
  }
  if (!claimed) {
    throw new AdminMutationError(
      "This book copy is no longer available or not in borrowable condition.",
      409
    );
  }

  const { data: lcb, error: lcbErr } = await supabase
    .from("library_card_books")
    .insert({
      card_id: params.cardId,
      book_id: params.bookId,
      copy_id: params.copyId,
      book_title: params.bookTitle,
      book_author: params.bookAuthor,
      book_isbn: params.bookIsbn,
      quantity: 1,
      loan_status: "borrowed",
    })
    .select("id")
    .maybeSingle();

  if (lcbErr) {
    // Roll back the claimed copy if the loan insert failed
    await supabase
      .from("book_copies")
      .update({ circulation_status: "Available" })
      .eq("id", params.copyId)
      .eq("circulation_status", "Borrowed");
    throw mapDatabaseError(lcbErr, "Failed to record borrowed copy.");
  }

  return {
    copyId: params.copyId,
    cardBookId: lcb ? Number(lcb.id) : null,
  };
}

/**
 * Claims physical copies (and checks member borrow limits) atomically using the
 * Postgres RPC `borrow_card_books_atomic` when available, with full rollback of
 * claimed copies, inserted loan rows, and legacy `book_inventory` decrements.
 */
async function borrowSnapshotsAtomically(
  supabase: SupabaseClient,
  cardId: number,
  snapshots: BookSnapshot[],
  options: { userId?: number | null } = {}
): Promise<{ claimedCopyIds: number[]; touchedBookIds: number[] }> {
  if (snapshots.length === 0) {
    return { claimedCopyIds: [], touchedBookIds: [] };
  }

  const touchedBookIds = new Set<number>(snapshots.map((s) => s.book_id));

  if (typeof supabase.rpc === "function") {
    let usedMultiRpc = false;
    try {
      const rpcRes = await supabase.rpc("borrow_card_books_atomic", {
        p_card_id: cardId,
        p_user_id: options.userId ?? null,
        p_max_active: CIRCULATION_RULES.MAX_ACTIVE_BORROWS,
        p_items: snapshots.map((s) => ({
          book_id: s.book_id,
          copy_id: s.copy_id,
          qty: s.qty,
          title: s.title,
          author: s.author,
          isbn: s.isbn,
        })),
      });

      if (!rpcRes.error && rpcRes.data) {
        const rows = Array.isArray(rpcRes.data) ? rpcRes.data : [rpcRes.data];
        usedMultiRpc = true;
        for (const bookId of touchedBookIds) {
          const { data: hasCopies } = await supabase
            .from("book_copies")
            .select("id")
            .eq("book_id", bookId)
            .limit(1);
          if (hasCopies && hasCopies.length > 0) {
            await recomputeBookInventoryCounts(supabase, bookId);
          }
        }
        return {
          claimedCopyIds: rows
            .map((r: Record<string, unknown>) => Number(r.claimed_copy_id))
            .filter((cid) => Number.isInteger(cid) && cid > 0),
          touchedBookIds: Array.from(touchedBookIds),
        };
      }

      if (rpcRes.error) {
        const msg = String(rpcRes.error.message ?? "");
        const code = String(rpcRes.error.code ?? "");
        if (code === "P0001" && /REPLACEMENT_PENDING/i.test(msg)) {
          throw new AdminMutationError(
            "Member has pending book replacement(s) blocking new borrows until resolved.",
            409
          );
        }
        if (code === "P0001" && /REFERENCE_ONLY/i.test(msg)) {
          throw new AdminMutationError(
            "Reference Section books are for room use only and cannot be borrowed.",
            400
          );
        }
        if (code === "P0001" && /BORROW_LIMIT_EXCEEDED/i.test(msg)) {
          throw new AdminMutationError(
            `Borrow limit exceeded (max ${CIRCULATION_RULES.MAX_ACTIVE_BORROWS} active books).`,
            409
          );
        }
        if (code === "P0001" && /COPY_NOT_AVAILABLE/i.test(msg)) {
          throw new AdminMutationError(
            "Requested book copy is not available or not in borrowable condition.",
            409
          );
        }
        if (code !== "42883" && code !== "PGRST202" && !/function .* does not exist/i.test(msg)) {
          throw mapDatabaseError(rpcRes.error, "Failed to borrow copies.");
        }
      }
    } catch (err) {
      if (err instanceof AdminMutationError || err instanceof AppError) throw err;
    }
    if (usedMultiRpc) {
      return { claimedCopyIds: [], touchedBookIds: Array.from(touchedBookIds) };
    }
  }

  const claimedCopyIds: number[] = [];
  const insertedLcbIds: number[] = [];
  const decrementedInventory: Array<{ id: number; qty: number }> = [];

  const rollbackClaimed = async () => {
    if (claimedCopyIds.length > 0) {
      await supabase
        .from("book_copies")
        .update({ circulation_status: "Available" })
        .in("id", claimedCopyIds);
    }
    for (const invEntry of decrementedInventory) {
      const { data: invNow } = await supabase
        .from("book_inventory")
        .select("id, available_copies")
        .eq("id", invEntry.id)
        .maybeSingle();
      if (invNow) {
        await supabase
          .from("book_inventory")
          .update({ available_copies: Number(invNow.available_copies ?? 0) + invEntry.qty })
          .eq("id", invEntry.id);
      }
    }
    if (insertedLcbIds.length > 0) {
      await supabase.from("library_card_books").delete().in("id", insertedLcbIds);
    }
  };

  try {
    for (const s of snapshots) {
      touchedBookIds.add(s.book_id);

      if (s.copy_id) {
        const res = await claimCopyAtomically(supabase, {
          cardId,
          bookId: s.book_id,
          copyId: s.copy_id,
          bookTitle: s.title,
          bookAuthor: s.author,
          bookIsbn: s.isbn,
        });
        claimedCopyIds.push(s.copy_id);
        if (res.cardBookId) insertedLcbIds.push(res.cardBookId);
        continue;
      }

      // Check whether this book has tracked rows in book_copies
      const { data: anyCopies } = await supabase
        .from("book_copies")
        .select("id, circulation_status, condition")
        .eq("book_id", s.book_id)
        .order("copy_number", { ascending: true })
        .limit(500);

      if (anyCopies && anyCopies.length > 0) {
        const availableCandidates = anyCopies.filter((c) => {
          const statusOk = String(c.circulation_status) === "Available";
          const cond = String(c.condition ?? "Good");
          const condOk = cond === "Good" || cond === "Fair";
          return statusOk && condOk;
        });
        if (availableCandidates.length < s.qty) {
          throw new AdminMutationError(
            `Only ${availableCandidates.length} available copy/copies in Good/Fair condition left for "${s.title}".`,
            409
          );
        }

        let claimedForBook = 0;
        for (const cand of availableCandidates) {
          if (claimedForBook >= s.qty) break;
          try {
            const res = await claimCopyAtomically(supabase, {
              cardId,
              bookId: s.book_id,
              copyId: Number(cand.id),
              bookTitle: s.title,
              bookAuthor: s.author,
              bookIsbn: s.isbn,
            });
            claimedCopyIds.push(Number(cand.id));
            if (res.cardBookId) insertedLcbIds.push(res.cardBookId);
            claimedForBook++;
          } catch (err) {
            if (err instanceof AdminMutationError && err.status === 409) {
              // Another concurrent request took this copy — try the next available copy
              continue;
            }
            throw err;
          }
        }

        if (claimedForBook < s.qty) {
          throw new AdminMutationError(
            `Insufficient available copies for "${s.title}" — another borrow completed concurrently.`,
            409
          );
        }
      } else {
        // Legacy fallback when a book has no rows in book_copies yet
        const { data: inv } = await supabase
          .from("book_inventory")
          .select("id, available_copies")
          .eq("book_id", s.book_id)
          .maybeSingle();

        const currentAvail = Number(inv?.available_copies ?? 0);
        if (!inv || currentAvail < s.qty) {
          throw new AdminMutationError(
            `Only ${currentAvail} available copy/copies left for "${s.title}".`,
            409
          );
        }

        const { data: updatedInv } = await supabase
          .from("book_inventory")
          .update({ available_copies: Math.max(0, currentAvail - s.qty) })
          .eq("id", inv.id)
          .eq("available_copies", currentAvail)
          .select("id")
          .maybeSingle();
        if (!updatedInv) {
          throw new AdminMutationError(
            `Inventory changed concurrently for "${s.title}". Please retry.`,
            409
          );
        }
        decrementedInventory.push({ id: Number(inv.id), qty: s.qty });

        const { data: lcbRow, error: lcbErr } = await supabase
          .from("library_card_books")
          .insert({
            card_id: cardId,
            book_id: s.book_id,
            book_title: s.title,
            book_author: s.author,
            book_isbn: s.isbn,
            quantity: s.qty,
            loan_status: "borrowed",
          })
          .select("id")
          .maybeSingle();
        if (lcbErr) {
          throw mapDatabaseError(lcbErr, "Failed to record borrowed book.");
        }
        if (lcbRow?.id) insertedLcbIds.push(Number(lcbRow.id));
      }
    }
  } catch (err) {
    await rollbackClaimed();
    throw err;
  }

  for (const bookId of touchedBookIds) {
    const { data: hasCopies } = await supabase
      .from("book_copies")
      .select("id")
      .eq("book_id", bookId)
      .limit(1);
    if (hasCopies && hasCopies.length > 0) {
      await recomputeBookInventoryCounts(supabase, bookId);
    }
  }

  return { claimedCopyIds, touchedBookIds: Array.from(touchedBookIds) };
}

/**
 * Enforces server-side member borrow eligibility:
 * 1. Member account is active and approved.
 * 2. Library card is not expired (valid_until >= today in Asia/Manila).
 * 3. Member is under the active borrow limit (MAX_ACTIVE_BORROWS).
 * 4. Member has no blocking unpaid, unwaived fines.
 */
async function assertMemberBorrowEligibility(
  supabase: SupabaseClient,
  userId: number,
  requestedQty: number,
  submittedValidUntil: string | null,
  todayIso: string
): Promise<void> {
  const { data: member, error: memberErr } = await supabase
    .from("users")
    .select("id, role, is_active, is_approved")
    .eq("id", userId)
    .maybeSingle();

  if (memberErr || !member) {
    throw new AdminMutationError("Selected member account was not found.", 404);
  }
  if (!member.is_active) {
    throw new AdminMutationError("Member account is inactive and cannot borrow books.", 403);
  }
  if (!member.is_approved) {
    throw new AdminMutationError("Member account is pending approval and cannot borrow books.", 403);
  }

  if (isCardExpired(submittedValidUntil, todayIso)) {
    throw new AdminMutationError("Member library card is expired.", 400);
  }

  const { data: existingCards } = await supabase
    .from("library_cards")
    .select("id, valid_until, date_return")
    .eq("user_id", userId)
    .order("id", { ascending: false })
    .limit(500);

  const cards = existingCards ?? [];
  if (cards.length > 0 && isCardExpired(cards[0]?.valid_until, todayIso)) {
    throw new AdminMutationError(
      "Member library card is expired. Please renew the card before borrowing.",
      400
    );
  }

  if (cards.length === 0) {
    if (requestedQty > CIRCULATION_RULES.MAX_ACTIVE_BORROWS) {
      throw new AdminMutationError(
        `A member cannot borrow more than ${CIRCULATION_RULES.MAX_ACTIVE_BORROWS} books at once.`,
        409
      );
    }
    return;
  }

  const { totalUnpaid, activeBorrowedCount, pendingReplacementCount } =
    await computeMemberUnpaidFineBalance(supabase, userId, todayIso, {
      preloadedCards: cards as Array<Record<string, unknown>>,
    });

  if (pendingReplacementCount > 0) {
    throw new AdminMutationError(
      "Member has pending book replacement(s) blocking new borrows until resolved.",
      409
    );
  }

  if (totalUnpaid >= CIRCULATION_RULES.BLOCKING_UNPAID_FINE_PHP) {
    throw new AdminMutationError(
      `Member has unpaid fines of PHP ${totalUnpaid.toFixed(2)} blocking new borrows.`,
      409
    );
  }

  if (activeBorrowedCount + requestedQty > CIRCULATION_RULES.MAX_ACTIVE_BORROWS) {
    throw new AdminMutationError(
      `Borrow limit exceeded: member currently has ${activeBorrowedCount} active book(s) (max ${CIRCULATION_RULES.MAX_ACTIVE_BORROWS}).`,
      409
    );
  }
}

export async function queryLibraryCards(
  supabase: SupabaseClient,
  options: LibraryCardsQueryOptions = {}
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
  const statusFilter = (options.status ?? "").trim().toLowerCase();
  const fromDate = (options.from ?? "").trim();
  const toDate = (options.to ?? "").trim();
  const sortField = (options.sort ?? "id").trim().toLowerCase();
  const sortAsc = options.order === "asc";
  const isLibrarian = actor.role === "librarian";
  const todayIso = getManilaTodayISO();
  const holidayDates = await loadLibraryHolidayDateSet(supabase);

  const singleId = options.id;
  let cardsQuery = supabase
    .from("library_cards")
    .select(
      "id, card_type_category, user_id, firstname, lastname, phone_number, address, date_issued, date_return, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date, card_type, valid_until, photo_path, registered_by, created_at"
    );
  const cardBooksFullSelect =
    "id, card_id, book_id, copy_id, book_title, book_author, book_isbn, quantity, loan_status, fine_amount, fine_paid, fine_waived, incident_type, incident_reason, affidavit_reference, replacement_resolution, replacement_resolved_at, replacement_resolution_reason, replacement_copy_id, replacement_payment_id";
  const cardBooksBaseSelect =
    "id, card_id, book_id, copy_id, book_title, book_author, book_isbn, quantity, loan_status, fine_amount, fine_paid, fine_waived";
  let cardBooksQuery = supabase.from("library_card_books").select(cardBooksFullSelect);
  let returnsQuery = supabase
    .from("book_returns")
    .select("id, card_id, return_date, overdue_days, fine_amount, fine_paid, fine_waived");

  if (singleId !== undefined) {
    cardsQuery = cardsQuery.eq("id", singleId).limit(1);
    cardBooksQuery = cardBooksQuery.eq("card_id", singleId).limit(fetchCap);
    returnsQuery = returnsQuery.eq("card_id", singleId).limit(fetchCap);
  } else {
    cardsQuery = cardsQuery.order("id", { ascending: false }).limit(fetchCap);
    cardBooksQuery = cardBooksQuery.limit(fetchCap * 4);
    returnsQuery = returnsQuery.limit(fetchCap);
  }

  const [cardsRes, initialCardBooksRes, returnsRes] = await Promise.all([
    cardsQuery,
    cardBooksQuery,
    returnsQuery,
  ]);
  let cardBooksData = (initialCardBooksRes.data ?? []) as Array<Record<string, unknown>>;
  let cardBooksError = initialCardBooksRes.error;
  if (cardBooksError && isMissingColumnError(cardBooksError)) {
    let fallbackCbQuery = supabase.from("library_card_books").select(cardBooksBaseSelect);
    fallbackCbQuery =
      singleId !== undefined
        ? fallbackCbQuery.eq("card_id", singleId).limit(fetchCap)
        : fallbackCbQuery.limit(fetchCap * 4);
    const fallbackRes = await fallbackCbQuery;
    cardBooksData = (fallbackRes.data ?? []) as Array<Record<string, unknown>>;
    cardBooksError = fallbackRes.error;
  }
  if (cardsRes.error) throw mapDatabaseError(cardsRes.error, "Failed to load borrow records.");
  if (cardBooksError) throw mapDatabaseError(cardBooksError, "Failed to load borrow records.");
  if (returnsRes.error) throw mapDatabaseError(returnsRes.error, "Failed to load borrow records.");

  const staffIds = Array.from(
    new Set(
      (cardsRes.data ?? [])
        .map((c) => Number(c.registered_by))
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

  const returnsByCard = new Map<number, Record<string, unknown>[]>();
  for (const r of returnsRes.data ?? []) {
    const cid = Number(r.card_id);
    const list = returnsByCard.get(cid) ?? [];
    list.push(r);
    returnsByCard.set(cid, list);
  }

  const booksByCard = new Map<number, Record<string, unknown>[]>();
  for (const cb of cardBooksData) {
    const cid = cb.card_id as number;
    const list = booksByCard.get(cid) ?? [];
    list.push({
      ...cb,
      title: cb.book_title,
      author: cb.book_author,
      isbn: cb.book_isbn,
    });
    booksByCard.set(cid, list);
  }

  const fetchedCardIds = (cardsRes.data ?? [])
    .map((c) => Number(c.id))
    .filter((cid) => Number.isInteger(cid) && cid > 0);
  const paidByCard = new Map<number, number>();
  if (fetchedCardIds.length > 0) {
    const payRes = await supabase
      .from("fine_payments")
      .select("card_id, amount_paid")
      .in("card_id", fetchedCardIds);
    if (payRes.error && !isMissingTableError(payRes.error)) {
      throw mapDatabaseError(payRes.error, "Failed to load fine payments.");
    }
    for (const p of payRes.data ?? []) {
      const cid = Number(p.card_id);
      paidByCard.set(cid, (paidByCard.get(cid) ?? 0) + Number(p.amount_paid ?? 0));
    }
  }

  let rows = (cardsRes.data ?? []).map((c) => {
    const cid = Number(c.id);
    const cardBooks = booksByCard.get(cid) ?? [];
    const cardReturns = returnsByCard.get(cid) ?? [];
    const latestRet = cardReturns[cardReturns.length - 1];
    const hasActiveBook = cardBooks.some((b) => {
      const ls = String(b.loan_status ?? "borrowed");
      return ls === "borrowed" || ls === "overdue";
    });
    const hasLostBook = cardBooks.some((b) => String(b.loan_status ?? "") === "lost");
    const hasReplacementPending = cardBooks.some(
      (b) => String(b.loan_status ?? "") === "replacement_pending"
    );
    const isReturned =
      cardBooks.length > 0
        ? !hasActiveBook && !hasLostBook && !hasReplacementPending
        : cardReturns.length > 0;
    const fn = safeDecryptPii(c.firstname);
    const ln = safeDecryptPii(c.lastname);
    const rawPhoto = c.photo_path ? String(c.photo_path).replace(/\\/g, "/") : "";
    const photoUrl = rawPhoto
      ? rawPhoto.startsWith("/") || rawPhoto.startsWith("http")
        ? rawPhoto
        : `/${rawPhoto}`
      : "";

    const activeQty = cardBooks
      .filter((b) => {
        const ls = String(b.loan_status ?? "borrowed");
        return ls === "borrowed" || ls === "overdue";
      })
      .reduce((s, b) => s + Math.max(1, Number(b.quantity ?? 1) || 1), 0);

    const overdueDays = isReturned
      ? Number(
          latestRet?.overdue_days ??
            computeOverdueDays(
              c.date_return,
              String(latestRet?.return_date ?? todayIso),
              holidayDates
            )
        )
      : hasActiveBook || cardBooks.length === 0
        ? computeOverdueDays(c.date_return, todayIso, holidayDates)
        : Number(latestRet?.overdue_days ?? 0);
    const unwaivedReturnFine = cardReturns.reduce(
      (s, r) => (r.fine_waived || r.fine_paid ? s : s + Number(r.fine_amount ?? 0)),
      0
    );
    const unwaivedBookFine = cardBooks.reduce(
      (s, b) => (b.fine_waived || b.fine_paid ? s : s + Number(b.fine_amount ?? 0)),
      0
    );
    const paidAmount = paidByCard.get(cid) ?? 0;
    const storedUnpaidFine = Math.max(0, unwaivedReturnFine + unwaivedBookFine - paidAmount);
    const liveOverdueFine =
      isReturned || (cardBooks.length > 0 && !hasActiveBook)
        ? 0
        : computeOverdueFine(overdueDays, Math.max(1, activeQty || 1));
    const fineAmount = Number((storedUnpaidFine + (liveOverdueFine > 0 && storedUnpaidFine === 0 ? liveOverdueFine : 0)).toFixed(2));
    const finedReturns = cardReturns.filter((r) => Number(r.fine_amount ?? 0) > 0);
    const finedBooks = cardBooks.filter((b) => Number(b.fine_amount ?? 0) > 0);
    const hasFinedRows = finedReturns.length > 0 || finedBooks.length > 0;
    const fineWaived =
      hasFinedRows &&
      finedReturns.every((r) => Boolean(r.fine_waived)) &&
      finedBooks.every((b) => Boolean(b.fine_waived));
    const status = isReturned
      ? "returned"
      : !hasActiveBook && hasReplacementPending
        ? "replacement_pending"
        : !hasActiveBook && hasLostBook
          ? "lost"
          : overdueDays > 0
            ? "overdue"
            : "active";

    // Librarians never receive patron contact PII (phone_number / address) for ANY card category
    const {
      phone_number: rawPhone,
      address: rawAddress,
      ...cardWithoutContact
    } = c as Record<string, unknown>;

    const baseCardRow = {
      ...cardWithoutContact,
      id: cid,
      card_type_category: c.card_type_category,
      date_issued: c.date_issued,
      date_return: c.date_return,
      type: c.card_type_category,
      firstname: fn,
      lastname: ln,
      fullname: formatFullName(c.firstname, c.lastname),
      photo_url: photoUrl,
      registered_by_name:
        typeof c.registered_by === "number"
          ? (staffMap.get(c.registered_by) ?? "—")
          : "—",
      books: cardBooks,
      books_count: cardBooks.reduce((s, b) => s + Number(b.quantity ?? 1), 0),
      is_returned: isReturned,
      has_replacement_pending: hasReplacementPending,
      status,
      overdue_days: overdueDays,
      fine_amount: fineWaived ? 0 : fineAmount,
      fine_waived: fineWaived,
    };

    if (isLibrarian) {
      return baseCardRow;
    }

    return {
      ...baseCardRow,
      phone_number: safeDecryptPii(rawPhone),
      address: safeDecryptPii(rawAddress),
    };
  });

  if (singleId !== undefined) {
    const card = rows[0];
    if (!card) {
      throw new AdminMutationError("Library card not found.", 404);
    }
    return {
      rows: [card],
      card,
      total: 1,
      page: 1,
      pageSize: 1,
      totalPages: 1,
    };
  }

  if (statusFilter) {
    rows = rows.filter(
      (r) =>
        r.status === statusFilter ||
        String(r.card_type_category).toLowerCase() === statusFilter
    );
  }
  if (options.overdue !== undefined) {
    rows = rows.filter((r) => (options.overdue ? r.status === "overdue" : r.status !== "overdue"));
  }
  if (fromDate) {
    rows = rows.filter((r) => String(r.date_issued ?? "") >= fromDate);
  }
  if (toDate) {
    rows = rows.filter((r) => String(r.date_issued ?? "") <= toDate);
  }
  if (q) {
    rows = rows.filter((r) => {
      const contactPart = isLibrarian
        ? ""
        : String((r as Record<string, unknown>).phone_number ?? "");
      const hay = `${r.fullname} ${contactPart} ${r.books
        .map((b) => `${b.book_title ?? ""} ${b.book_isbn ?? ""}`)
        .join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }

  rows.sort((a, b) => {
    let cmp = 0;
    if (sortField === "date_issued") {
      cmp = String(a.date_issued ?? "").localeCompare(String(b.date_issued ?? ""));
    } else if (sortField === "date_return") {
      cmp = String(a.date_return ?? "").localeCompare(String(b.date_return ?? ""));
    } else if (sortField === "overdue_days") {
      cmp = a.overdue_days - b.overdue_days;
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

export async function mutateLibraryCards(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  await verifyRepositoryActor(supabase, session.userId, STAFF_ROLES, session.sessionToken);
  const todayIso = getManilaTodayISO();

  if (action === "delete") {
    const parsedDel = libraryCardDeleteSchema.safeParse(payload);
    if (!parsedDel.success) {
      throw new AdminMutationError(
        parsedDel.error.issues[0]?.message || "Invalid delete payload.",
        400
      );
    }
    if (!id) throw new AdminMutationError("Card ID is required.", 400);
    const { data: existing } = await supabase
      .from("library_cards")
      .select("id, photo_path")
      .eq("id", id)
      .maybeSingle();
    if (!existing) {
      throw new AdminMutationError("Card not found.", 404);
    }

    // Release any physical copies currently held by this card before deletion
    const { data: cardBooks } = await supabase
      .from("library_card_books")
      .select("book_id, copy_id, quantity, loan_status")
      .eq("card_id", id);

    const activeItems = (cardBooks ?? []).filter(
      (cb) => cb.loan_status === "borrowed" || cb.loan_status === "overdue"
    );
    const activeCopyIds = activeItems
      .filter((cb) => cb.copy_id)
      .map((cb) => Number(cb.copy_id));

    if (activeCopyIds.length > 0) {
      await supabase
        .from("book_copies")
        .update({ circulation_status: "Available" })
        .in("id", activeCopyIds);
    }

    const { error } = await supabase.from("library_cards").delete().eq("id", id);
    if (error) throw mapDatabaseError(error, "Failed to delete library card.");

    const affectedBookIds = Array.from(
      new Set((cardBooks ?? []).map((cb) => Number(cb.book_id)).filter(Boolean))
    );
    for (const bid of affectedBookIds) {
      const { data: hasCopies } = await supabase
        .from("book_copies")
        .select("id")
        .eq("book_id", bid)
        .limit(1);
      if (hasCopies && hasCopies.length > 0) {
        await recomputeBookInventoryCounts(supabase, bid);
      } else {
        const activeQtyForBook = activeItems
          .filter((cb) => Number(cb.book_id) === bid)
          .reduce((s, cb) => s + Math.max(1, Number((cb as Record<string, unknown>).quantity ?? 1) || 1), 0);
        if (activeQtyForBook > 0) {
          const { data: inv } = await supabase
            .from("book_inventory")
            .select("id, volumes, available_copies")
            .eq("book_id", bid)
            .maybeSingle();
          if (inv) {
            await supabase
              .from("book_inventory")
              .update({
                available_copies: Math.min(
                  Number(inv.volumes ?? activeQtyForBook),
                  Number(inv.available_copies ?? 0) + activeQtyForBook
                ),
              })
              .eq("id", inv.id);
          }
        }
      }
    }

    if (existing.photo_path && isDropboxConfigured()) {
      const rawPath = String(existing.photo_path).trim();
      const dropboxPath = rawPath.startsWith("/")
        ? rawPath
        : `${DROPBOX_FOLDERS["card-photos"]().replace(/\/+$/, "")}/${rawPath.replace(/^.*[\\/]/, "")}`;
      void deleteFromDropbox(dropboxPath);
    }

    return {
      ok: true,
      deletedId: id,
      audit_details: `action=delete_library_card card_id=${id}`,
    };
  }

  if (action === "create") {
    const parsed = libraryCardCreateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "First name and last name are required.",
        400
      );
    }

    const data = parsed.data;
    const category = data.card_type_category === "member" ? "member" : "borrower";
    if (category === "member" && !data.user_id) {
      throw new AdminMutationError("A valid member user_id is required for member library cards.", 400);
    }

    const backdateReason = String(data.backdate_reason || "").trim();
    let dateIssued = todayIso;
    let isBackdated = false;
    if (backdateReason) {
      await verifyRepositoryActor(supabase, session.userId, ["admin"], session.sessionToken);
      const requestedIssued = String(data.date_issued || "").trim();
      if (!isIsoDate(requestedIssued) || requestedIssued > todayIso) {
        throw new AdminMutationError("Backdated issue date must be a valid YYYY-MM-DD date on or before today.", 400);
      }
      dateIssued = requestedIssued;
      isBackdated = true;
    }

    const loanDays = Math.min(CIRCULATION_RULES.DEFAULT_LOAN_DAYS, CIRCULATION_RULES.MAX_LOAN_DAYS);
    const resolvedDateReturn = addDaysToIsoDate(dateIssued, loanDays);

    const phone = String(data.phone_number || data.phone || "").trim() || null;
    const address = String(data.address || "").trim() || null;
    const photoPath = String(data.photo_path || "").trim() || null;
    const validUntil = String(data.valid_until || "").trim() || null;

    const ren1Checked =
      data.renewal1_checked === true ||
      data.renewal1_checked === "1" ||
      data.renewal1_checked === 1;
    const ren1Date = String(data.renewal1_date || "").trim() || null;
    const ren2Checked =
      data.renewal2_checked === true ||
      data.renewal2_checked === "1" ||
      data.renewal2_checked === 1;
    const ren2Date = String(data.renewal2_date || "").trim() || null;

    const bookId = data.book_id ? Number(data.book_id) : null;
    const legacyIsbn = String(data.isbn || data.book_isbn || "").trim() || null;
    const copyId = data.copy_id ? Number(data.copy_id) : null;
    const quantity = Math.max(1, Number(data.quantity ?? 1) || 1);
    const snapshots = await resolveBookSnapshots(
      supabase,
      bookId,
      copyId,
      quantity,
      data.book_ids,
      legacyIsbn
    );
    const totalRequestedQty = snapshots.reduce((sum, s) => sum + s.qty, 0);

    if (totalRequestedQty > CIRCULATION_RULES.MAX_ACTIVE_BORROWS) {
      throw new AdminMutationError(
        `Borrow limit exceeded: maximum ${CIRCULATION_RULES.MAX_ACTIVE_BORROWS} books per loan.`,
        409
      );
    }

    // Server-side member eligibility checks (card expiry, borrow limit, unpaid fines)
    const memberUserId = category === "member" && data.user_id ? Number(data.user_id) : null;
    if (memberUserId) {
      await assertMemberBorrowEligibility(
        supabase,
        memberUserId,
        totalRequestedQty,
        validUntil,
        todayIso
      );
    }

    const { data: card, error } = await supabase
      .from("library_cards")
      .insert({
        card_type_category: category,
        user_id: memberUserId,
        firstname: data.firstname,
        lastname: data.lastname,
        phone_number: phone,
        address,
        date_issued: dateIssued,
        date_return: resolvedDateReturn,
        renewal1_checked: ren1Checked,
        renewal1_date: ren1Date,
        renewal2_checked: ren2Checked,
        renewal2_date: ren2Date,
        card_type: String(data.card_type || "regular").trim() || "regular",
        valid_until: validUntil,
        photo_path: photoPath,
        registered_by: session.userId,
      })
      .select("id")
      .single();

    if (error || !card) {
      throw mapDatabaseError(error, "Failed to issue card.");
    }

    const newCardId = Number(card.id);
    try {
      await borrowSnapshotsAtomically(supabase, newCardId, snapshots, { userId: memberUserId });
    } catch (borrowErr) {
      // Roll back the newly created library_cards record so no orphan card remains
      await supabase.from("library_cards").delete().eq("id", newCardId);
      throw borrowErr;
    }

    const backdateAudit = isBackdated
      ? ` backdated=true date_issued=${dateIssued} backdate_reason=${JSON.stringify(backdateReason)}`
      : "";

    return {
      ok: true,
      id: newCardId,
      date_return: resolvedDateReturn,
      audit_details: `action=borrow card_id=${newCardId} category=${category} books=${totalRequestedQty}${backdateAudit}`,
    };
  }

  if (action === "return_books") {
    if (!id) throw new AdminMutationError("Card ID is required.", 400);
    const parsed = libraryCardReturnSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid return payload.",
        400
      );
    }

    const backdateReason = String(parsed.data.backdate_reason || "").trim();
    let returnDate = todayIso;
    let isBackdated = false;
    if (backdateReason) {
      await verifyRepositoryActor(supabase, session.userId, ["admin"], session.sessionToken);
      const requestedReturn = String(parsed.data.return_date || "").trim();
      if (!isIsoDate(requestedReturn) || requestedReturn > todayIso) {
        throw new AdminMutationError("Backdated return date must be a valid YYYY-MM-DD date on or before today.", 400);
      }
      returnDate = requestedReturn;
      isBackdated = true;
    }

    const { data: existingCard } = await supabase
      .from("library_cards")
      .select("id, date_return")
      .eq("id", id)
      .maybeSingle();
    if (!existingCard) {
      throw new AdminMutationError("Card not found.", 404);
    }

    const { data: cardBooks } = await supabase
      .from("library_card_books")
      .select("*")
      .eq("card_id", id)
      .order("id", { ascending: true });

    if (!cardBooks || cardBooks.length === 0) {
      throw new AdminMutationError("No borrowed books recorded on this card.", 400);
    }

    const activeCardBooks = cardBooks.filter(
      (cb) => cb.loan_status === "borrowed" || cb.loan_status === "overdue"
    );
    if (activeCardBooks.length === 0) {
      throw new AdminMutationError("All borrowed books on this card have already been returned.", 409);
    }

    const cardBookIds = cardBooks.map((cb) => Number(cb.id)).filter((cid) => cid > 0);
    const alreadyReturnedByLcb = new Map<number, number>();
    if (cardBookIds.length > 0) {
      const { data: prevReturnItems } = await supabase
        .from("book_return_items")
        .select("card_book_id, qty_returned")
        .in("card_book_id", cardBookIds);
      for (const pri of prevReturnItems ?? []) {
        const cbId = Number(pri.card_book_id);
        alreadyReturnedByLcb.set(cbId, (alreadyReturnedByLcb.get(cbId) ?? 0) + Number(pri.qty_returned ?? 0));
      }
    }

    const itemsToReturn: Array<{
      cb: Record<string, unknown>;
      qtyReturned: number;
      remainingAfterReturn: number;
      returnCondition: string;
      conditionNotes: string;
      affidavitReference: string;
    }> = [];

    if (parsed.data.items !== undefined) {
      if (parsed.data.items.length === 0) {
        throw new AdminMutationError("Select at least one book item to return.", 400);
      }
      for (const item of parsed.data.items) {
        const qtyReturned = Number(item.qty_returned ?? 0);
        if (!Number.isInteger(qtyReturned) || qtyReturned <= 0) continue;

        let matchedCb: Record<string, unknown> | undefined;
        if (item.card_book_id) {
          matchedCb = cardBooks.find((cb) => Number(cb.id) === Number(item.card_book_id));
        } else if (
          item.row_index !== undefined &&
          item.row_index >= 0 &&
          item.row_index < cardBooks.length
        ) {
          matchedCb = cardBooks[item.row_index];
        }
        if (!matchedCb) {
          throw new AdminMutationError("Selected borrowed book item was not found on this card.", 404);
        }
        const ls = String(matchedCb.loan_status ?? "borrowed");
        if (ls !== "borrowed" && ls !== "overdue") {
          throw new AdminMutationError("Selected book item has already been returned or closed.", 409);
        }
        const borrowedQty = Math.max(1, Number(matchedCb.quantity ?? 1) || 1);
        const prevQty = alreadyReturnedByLcb.get(Number(matchedCb.id)) ?? 0;
        const remainingQty = Math.max(0, borrowedQty - prevQty);
        if (remainingQty <= 0) {
          throw new AdminMutationError("Selected book item has already been fully returned.", 409);
        }
        if (qtyReturned > remainingQty) {
          throw new AdminMutationError(
            `Return quantity (${qtyReturned}) exceeds remaining borrowed quantity (${remainingQty}).`,
            400
          );
        }
        const returnCondition = item.return_condition ?? "Good";
        const affidavitReference = String(item.affidavit_reference ?? "").trim();
        if (returnCondition === "Lost" && affidavitReference.length < 3) {
          throw new AdminMutationError(
            "An affidavit reference (at least 3 characters) is required when reporting a lost book.",
            400
          );
        }
        alreadyReturnedByLcb.set(Number(matchedCb.id), prevQty + qtyReturned);
        itemsToReturn.push({
          cb: matchedCb,
          qtyReturned,
          remainingAfterReturn: remainingQty - qtyReturned,
          returnCondition,
          conditionNotes: item.condition_notes ?? "",
          affidavitReference,
        });
      }
    } else {
      for (const cb of activeCardBooks) {
        const borrowedQty = Math.max(1, Number(cb.quantity ?? 1) || 1);
        const prevQty = alreadyReturnedByLcb.get(Number(cb.id)) ?? 0;
        const remainingQty = Math.max(0, borrowedQty - prevQty);
        if (remainingQty <= 0) continue;
        itemsToReturn.push({
          cb,
          qtyReturned: remainingQty,
          remainingAfterReturn: 0,
          returnCondition: "Good",
          conditionNotes: "",
          affidavitReference: "",
        });
      }
    }

    if (itemsToReturn.length === 0) {
      throw new AdminMutationError("Return quantity must be greater than zero.", 400);
    }

    // Server-side overdue fine computation in Asia/Manila (never trust client, no flat incident fees)
    const holidayDates = await loadLibraryHolidayDateSet(supabase);
    const overdueDays = computeOverdueDays(existingCard.date_return, returnDate, holidayDates);
    const totalQtyReturned = itemsToReturn.reduce((sum, it) => sum + it.qtyReturned, 0);
    const overdueFine = computeOverdueFine(overdueDays, Math.max(1, totalQtyReturned));
    const fineAmount = overdueFine;
    const nowIso = new Date().toISOString();

    let { data: retRow, error } = await supabase
      .from("book_returns")
      .insert({
        card_id: id,
        return_date: returnDate,
        processed_by: session.userId,
        overdue_days: overdueDays,
        fine_amount: fineAmount,
        returned_at: nowIso,
      })
      .select("id")
      .single();

    if (error) {
      if (!isMissingColumnError(error)) {
        throw mapDatabaseError(error, "Failed to log return.");
      }
      // Graceful fallback only if migration 011 columns are not yet applied
      const fallback = await supabase
        .from("book_returns")
        .insert({
          card_id: id,
          return_date: returnDate,
          processed_by: session.userId,
        })
        .select("id")
        .single();
      if (fallback.error || !fallback.data) {
        throw mapDatabaseError(fallback.error, "Failed to log return.");
      }
      retRow = fallback.data;
    }

    const touchedBookIds = new Set<number>();

    for (const {
      cb,
      qtyReturned,
      remainingAfterReturn,
      returnCondition,
      conditionNotes,
      affidavitReference,
    } of itemsToReturn) {
      const baseItem = {
        return_id: retRow!.id,
        card_book_id: cb.id,
        book_title: cb.book_title,
        book_author: cb.book_author,
        book_isbn: cb.book_isbn,
        qty_returned: qtyReturned,
      };
      const itemIns = await supabase.from("book_return_items").insert({
        ...baseItem,
        book_id: cb.book_id ?? null,
        copy_id: cb.copy_id ?? null,
        return_condition: returnCondition,
        condition_notes: conditionNotes || null,
      });
      if (itemIns.error) {
        if (!isMissingColumnError(itemIns.error)) {
          throw mapDatabaseError(itemIns.error, "Failed to record returned book item.");
        }
        const fallbackItem = await supabase.from("book_return_items").insert(baseItem);
        if (fallbackItem.error) {
          throw mapDatabaseError(fallbackItem.error, "Failed to record returned book item.");
        }
      }

      if (remainingAfterReturn === 0) {
        const isIncident =
          returnCondition === "Damaged" ||
          returnCondition === "Destroyed" ||
          returnCondition === "Lost";
        const finalStatus = isIncident ? "replacement_pending" : "returned";
        const fullLcbUpdate: Record<string, unknown> = {
          loan_status: finalStatus,
          returned_at: nowIso,
        };
        if (isIncident) {
          fullLcbUpdate.fine_amount = 0;
          fullLcbUpdate.incident_type = returnCondition === "Lost" ? "lost" : "damaged";
          fullLcbUpdate.incident_reason = conditionNotes || returnCondition;
          if (returnCondition === "Lost" && affidavitReference) {
            fullLcbUpdate.affidavit_reference = affidavitReference;
          }
        }
        const lcbUpd = await supabase
          .from("library_card_books")
          .update(fullLcbUpdate)
          .eq("id", cb.id);
        if (lcbUpd.error) {
          if (!isMissingColumnError(lcbUpd.error)) {
            throw mapDatabaseError(lcbUpd.error, "Failed to update loan status on return.");
          }
          const lcbMinimal = await supabase
            .from("library_card_books")
            .update({ loan_status: finalStatus, returned_at: nowIso })
            .eq("id", cb.id);
          if (lcbMinimal.error) {
            if (!isMissingColumnError(lcbMinimal.error)) {
              throw mapDatabaseError(lcbMinimal.error, "Failed to update loan status on return.");
            }
            const lcbFallback = await supabase
              .from("library_card_books")
              .update({ loan_status: finalStatus })
              .eq("id", cb.id);
            if (lcbFallback.error) {
              throw mapDatabaseError(lcbFallback.error, "Failed to update loan status on return.");
            }
          }
        }
      }

      if (cb.copy_id) {
        const isUnusable =
          returnCondition === "Damaged" ||
          returnCondition === "Destroyed" ||
          returnCondition === "Lost";
        const { error: copyUpdErr } = await supabase
          .from("book_copies")
          .update({
            circulation_status: isUnusable ? "Unusable" : "Available",
            condition: returnCondition,
            ...(conditionNotes ? { condition_notes: conditionNotes } : {}),
          })
          .eq("id", Number(cb.copy_id));
        if (copyUpdErr) {
          throw mapDatabaseError(copyUpdErr, "Failed to update copy circulation status.");
        }
      }

      if (cb.book_id) {
        touchedBookIds.add(Number(cb.book_id));
      }
    }

    for (const bid of touchedBookIds) {
      const { data: hasCopies } = await supabase
        .from("book_copies")
        .select("id")
        .eq("book_id", bid)
        .limit(1);
      if (hasCopies && hasCopies.length > 0) {
        await recomputeBookInventoryCounts(supabase, bid);
      } else {
        const itemsForBook = itemsToReturn.filter((it) => Number(it.cb.book_id) === bid);
        const goodQty = itemsForBook
          .filter((it) => it.returnCondition === "Good" || it.returnCondition === "Fair")
          .reduce((s, it) => s + it.qtyReturned, 0);
        const damagedQty = itemsForBook
          .filter((it) => it.returnCondition === "Damaged")
          .reduce((s, it) => s + it.qtyReturned, 0);
        const destroyedQty = itemsForBook
          .filter((it) => it.returnCondition === "Destroyed")
          .reduce((s, it) => s + it.qtyReturned, 0);
        const lostQty = itemsForBook
          .filter((it) => it.returnCondition === "Lost")
          .reduce((s, it) => s + it.qtyReturned, 0);

        const { data: inv } = await supabase
          .from("book_inventory")
          .select("id, volumes, available_copies, damaged_copies, destroyed_copies, lost_copies")
          .eq("book_id", bid)
          .maybeSingle();
        if (inv) {
          const { error: invErr } = await supabase
            .from("book_inventory")
            .update({
              available_copies: Math.min(
                Number(inv.volumes ?? goodQty),
                Number(inv.available_copies ?? 0) + goodQty
              ),
              damaged_copies: Number(inv.damaged_copies ?? 0) + damagedQty,
              destroyed_copies: Number(inv.destroyed_copies ?? 0) + destroyedQty,
              lost_copies: Number(inv.lost_copies ?? 0) + lostQty,
            })
            .eq("id", inv.id);
          if (invErr) throw mapDatabaseError(invErr, "Failed to update book inventory on return.");
        }
      }
    }

    const backdateAudit = isBackdated
      ? ` backdated=true return_date=${returnDate} backdate_reason=${JSON.stringify(backdateReason)}`
      : "";

    return {
      ok: true,
      returnId: retRow!.id,
      return_id: retRow!.id,
      overdue_days: overdueDays,
      fine_amount: fineAmount,
      audit_details: `action=return_books card_id=${id} return_id=${retRow!.id} overdue_days=${overdueDays} fine=${fineAmount}${backdateAudit}`,
    };
  }

  if (action === "mark_lost" || action === "mark_damaged") {
    if (!id) throw new AdminMutationError("Card ID is required.", 400);
    const parsed = libraryCardMarkIncidentSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "A reason is required.",
        400
      );
    }

    const kind = action === "mark_lost" ? "lost" : "damaged";
    const targetCondition = kind === "lost" ? "Lost" : "Damaged";
    const affidavitRef = String(parsed.data.affidavit_reference ?? "").trim();
    if (kind === "lost" && affidavitRef.length < 3) {
      throw new AdminMutationError(
        "An affidavit reference (at least 3 characters) is required when marking a book as lost.",
        400
      );
    }

    const { data: cardBooks } = await supabase
      .from("library_card_books")
      .select("id, card_id, book_id, copy_id, quantity, loan_status")
      .eq("card_id", id);

    if (!cardBooks || cardBooks.length === 0) {
      throw new AdminMutationError("No borrowed books found on this card.", 404);
    }

    const targetLcb = parsed.data.card_book_id
      ? cardBooks.find((cb) => Number(cb.id) === parsed.data.card_book_id)
      : parsed.data.copy_id
        ? cardBooks.find((cb) => Number(cb.copy_id) === parsed.data.copy_id)
        : cardBooks[0];

    if (!targetLcb) {
      if (parsed.data.card_book_id === undefined && parsed.data.copy_id !== undefined) {
        throw new AdminMutationError("Provided copy_id does not belong to any loan on this card.", 400);
      }
      throw new AdminMutationError("Borrowed book entry not found on this card.", 404);
    }

    const currentLoanStatus = String(targetLcb.loan_status ?? "borrowed");
    if (currentLoanStatus !== "borrowed" && currentLoanStatus !== "overdue") {
      throw new AdminMutationError("Cannot mark a loan that is already returned or closed.", 409);
    }

    if (
      parsed.data.copy_id !== undefined &&
      Number(targetLcb.copy_id ?? 0) !== parsed.data.copy_id
    ) {
      throw new AdminMutationError("Provided copy_id does not match the loan's copy.", 400);
    }

    const reasonText = parsed.data.reason;
    const notesText = parsed.data.condition_notes || reasonText;
    const copyIdToUpdate = targetLcb.copy_id ? Number(targetLcb.copy_id) : null;

    if (copyIdToUpdate) {
      const { error: copyErr } = await supabase
        .from("book_copies")
        .update({
          condition: targetCondition,
          circulation_status: "Unusable",
          condition_notes: notesText,
        })
        .eq("id", copyIdToUpdate);
      if (copyErr) throw mapDatabaseError(copyErr, "Failed to update copy status.");
    }

    const incidentFields: Record<string, unknown> = {
      loan_status: "replacement_pending",
      fine_amount: 0,
      incident_type: kind,
      incident_reason: reasonText,
      ...(kind === "lost" ? { affidavit_reference: affidavitRef } : {}),
    };

    const lcbUpdate = await supabase
      .from("library_card_books")
      .update(incidentFields)
      .eq("id", Number(targetLcb.id));

    if (lcbUpdate.error) {
      if (!isMissingColumnError(lcbUpdate.error)) {
        throw mapDatabaseError(lcbUpdate.error, "Failed to update loan incident record.");
      }
      const fallbackLcb = await supabase
        .from("library_card_books")
        .update({ loan_status: "replacement_pending" })
        .eq("id", Number(targetLcb.id));
      if (fallbackLcb.error) {
        throw mapDatabaseError(fallbackLcb.error, "Failed to update loan status.");
      }
    }

    if (targetLcb.book_id) {
      const bid = Number(targetLcb.book_id);
      const { data: hasCopies } = await supabase
        .from("book_copies")
        .select("id")
        .eq("book_id", bid)
        .limit(1);
      if (hasCopies && hasCopies.length > 0) {
        await recomputeBookInventoryCounts(supabase, bid);
      } else {
        const incidentQty = Math.max(1, Number((targetLcb as Record<string, unknown>).quantity ?? 1) || 1);
        const { data: inv } = await supabase
          .from("book_inventory")
          .select("id, damaged_copies, lost_copies")
          .eq("book_id", bid)
          .maybeSingle();
        if (inv) {
          await supabase
            .from("book_inventory")
            .update(
              kind === "lost"
                ? { lost_copies: Number(inv.lost_copies ?? 0) + incidentQty }
                : { damaged_copies: Number(inv.damaged_copies ?? 0) + incidentQty }
            )
            .eq("id", inv.id);
        }
      }
    }

    return {
      ok: true,
      id,
      card_book_id: Number(targetLcb.id),
      copy_id: copyIdToUpdate,
      loan_status: "replacement_pending",
      audit_details: `action=${action} card_id=${id} card_book_id=${targetLcb.id} loan_status=replacement_pending`,
    };
  }

  if (action === "resolve_replacement") {
    if (!id) throw new AdminMutationError("Card ID is required.", 400);
    const parsed = libraryCardResolveReplacementSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid replacement resolution payload.",
        400
      );
    }

    const {
      card_book_id: targetLcbId,
      resolution,
      reason,
      replacement_accession_number: rawAcc,
      replacement_condition: repCond,
      replacement_notes: repNotes,
      shelf_location: rawShelf,
      amount,
      payment_method: paymentMethod,
      idempotency_key: idempotencyKey,
      approved_by_city_librarian: approvedByCityLibrarian,
      note,
    } = parsed.data;

    if (resolution === "waived") {
      await verifyRepositoryActor(supabase, session.userId, ["admin"], session.sessionToken);
    }

    const { data: cardRow, error: cardErr } = await supabase
      .from("library_cards")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();
    if (cardErr) throw mapDatabaseError(cardErr, "Failed to load library card.");
    if (!cardRow) {
      throw new AdminMutationError("Card not found.", 404);
    }

    const { data: targetLcb, error: lcbErr } = await supabase
      .from("library_card_books")
      .select("id, card_id, book_id, copy_id, quantity, loan_status")
      .eq("id", targetLcbId)
      .eq("card_id", id)
      .maybeSingle();
    if (lcbErr) throw mapDatabaseError(lcbErr, "Failed to load borrowed book entry.");
    if (!targetLcb) {
      throw new AdminMutationError("Borrowed book entry not found on this card.", 404);
    }

    if (String(targetLcb.loan_status ?? "") !== "replacement_pending") {
      throw new AdminMutationError(
        "Only loans with status 'replacement_pending' can be resolved.",
        409
      );
    }

    const nowIso = new Date().toISOString();

    if (resolution === "replaced") {
      if (targetLcb.copy_id) {
        const { error: retireErr } = await supabase
          .from("book_copies")
          .update({ circulation_status: "Unusable" })
          .eq("id", Number(targetLcb.copy_id));
        if (retireErr) throw mapDatabaseError(retireErr, "Failed to verify retired copy status.");
      }

      let replacementCopyId: number | null = null;
      if (targetLcb.book_id) {
        const bookId = Number(targetLcb.book_id);
        const [copiesRes, invRes] = await Promise.all([
          supabase
            .from("book_copies")
            .select("id, copy_number, shelf_location")
            .eq("book_id", bookId)
            .limit(1000),
          supabase
            .from("book_inventory")
            .select("id, volumes, available_copies, shelf_location")
            .eq("book_id", bookId)
            .maybeSingle(),
        ]);
        if (copiesRes.error) throw mapDatabaseError(copiesRes.error, "Failed to read book copies.");
        if (invRes.error) throw mapDatabaseError(invRes.error, "Failed to read book inventory.");

        const existingCopies = copiesRes.data ?? [];
        const hadExistingCopies = existingCopies.length > 0;
        const maxCopyNum = existingCopies.reduce(
          (max, c) => Math.max(max, Number(c.copy_number ?? 0)),
          0
        );
        const nextCopyNumber = maxCopyNum + 1;
        const accessionNumber =
          (rawAcc && rawAcc.trim()) ||
          `ICPL-${String(bookId).padStart(4, "0")}-C${String(nextCopyNumber).padStart(3, "0")}`;
        const shelfLocation =
          (rawShelf && rawShelf.trim()) ||
          String(invRes.data?.shelf_location ?? "").trim() ||
          String(existingCopies[0]?.shelf_location ?? "").trim() ||
          "Main Stack";

        const { data: newCopy, error: insCopyErr } = await supabase
          .from("book_copies")
          .insert({
            book_id: bookId,
            copy_number: nextCopyNumber,
            accession_number: accessionNumber,
            condition: repCond ?? "Good",
            circulation_status: "Available",
            condition_notes: (repNotes && repNotes.trim()) || reason,
            shelf_location: shelfLocation,
          })
          .select("id")
          .single();

        if (insCopyErr || !newCopy) {
          throw mapDatabaseError(insCopyErr, "Failed to register replacement book copy.");
        }
        replacementCopyId = Number(newCopy.id);

        if (hadExistingCopies) {
          await recomputeBookInventoryCounts(supabase, bookId);
        } else if (invRes.data) {
          const { error: invUpdErr } = await supabase
            .from("book_inventory")
            .update({
              volumes: Number(invRes.data.volumes ?? 0) + 1,
              available_copies: Number(invRes.data.available_copies ?? 0) + 1,
              status: "Available",
            })
            .eq("id", invRes.data.id);
          if (invUpdErr) {
            throw mapDatabaseError(invUpdErr, "Failed to update book inventory after replacement.");
          }
        }
      }

      const { error: updErr } = await supabase
        .from("library_card_books")
        .update({
          loan_status: "replaced",
          replacement_resolution: "replaced",
          replacement_copy_id: replacementCopyId,
          replacement_resolved_by: session.userId,
          replacement_resolved_at: nowIso,
          replacement_resolution_reason: reason,
        })
        .eq("id", targetLcbId);
      if (updErr) throw mapDatabaseError(updErr, "Failed to resolve replacement.");

      return {
        ok: true,
        id,
        card_book_id: targetLcbId,
        resolution: "replaced",
        loan_status: "replaced",
        replacement_copy_id: replacementCopyId,
        audit_details: `action=resolve_replacement card_id=${id} card_book_id=${targetLcbId} resolution=replaced replacement_copy_id=${replacementCopyId ?? "null"}`,
      };
    }

    if (resolution === "paid_equivalent") {
      if (amount === undefined || amount <= 0) {
        throw new AdminMutationError("A positive equivalent payment amount is required.", 400);
      }
      if (!idempotencyKey || idempotencyKey.trim().length < 8) {
        throw new AdminMutationError(
          "An idempotency key (at least 8 characters) is required.",
          400
        );
      }
      if (approvedByCityLibrarian !== true) {
        throw new AdminMutationError(
          "City Librarian approval (approved_by_city_librarian: true) is required for paid equivalent resolution.",
          400
        );
      }

      const key = idempotencyKey.trim();
      const existingPayRes = await supabase
        .from("fine_payments")
        .select("id, card_id, amount_paid")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (existingPayRes.error && !isMissingTableError(existingPayRes.error)) {
        throw mapDatabaseError(existingPayRes.error, "Failed to verify idempotency key.");
      }
      if (existingPayRes.data) {
        return {
          ok: true,
          idempotent_replay: true,
          id,
          card_book_id: targetLcbId,
          payment_id: Number(existingPayRes.data.id),
          resolution: "paid_equivalent",
          loan_status: "paid_equivalent",
          amount_paid: Number(existingPayRes.data.amount_paid),
          audit_details: `action=resolve_replacement replay=true card_id=${id} card_book_id=${targetLcbId} key=${key}`,
        };
      }

      const payAmount = Number(amount.toFixed(2));
      const { data: insertedPay, error: insPayErr } = await supabase
        .from("fine_payments")
        .insert({
          idempotency_key: key,
          card_id: id,
          card_book_id: targetLcbId,
          user_id: cardRow.user_id ?? null,
          amount_paid: payAmount,
          payment_method: paymentMethod ?? "cash",
          receipt_note: (note && note.trim()) || reason,
          recorded_by: session.userId,
        })
        .select("id")
        .single();

      let paymentId: number;
      if (insPayErr) {
        const eCode = String((insPayErr as { code?: unknown }).code ?? "");
        if (eCode === "23505") {
          const { data: replayRow } = await supabase
            .from("fine_payments")
            .select("id, card_id, amount_paid")
            .eq("idempotency_key", key)
            .maybeSingle();
          if (replayRow) {
            return {
              ok: true,
              idempotent_replay: true,
              id,
              card_book_id: targetLcbId,
              payment_id: Number(replayRow.id),
              resolution: "paid_equivalent",
              loan_status: "paid_equivalent",
              amount_paid: Number(replayRow.amount_paid),
              audit_details: `action=resolve_replacement replay=true card_id=${id} card_book_id=${targetLcbId} key=${key}`,
            };
          }
        }
        throw mapDatabaseError(insPayErr, "Failed to record equivalent replacement payment.");
      }
      paymentId = Number(insertedPay!.id);

      const { error: updErr } = await supabase
        .from("library_card_books")
        .update({
          loan_status: "paid_equivalent",
          fine_amount: payAmount,
          fine_paid: true,
          replacement_resolution: "paid_equivalent",
          replacement_payment_id: paymentId,
          replacement_resolved_by: session.userId,
          replacement_resolved_at: nowIso,
          replacement_resolution_reason: reason,
        })
        .eq("id", targetLcbId);
      if (updErr) throw mapDatabaseError(updErr, "Failed to resolve replacement payment.");

      return {
        ok: true,
        id,
        card_book_id: targetLcbId,
        resolution: "paid_equivalent",
        loan_status: "paid_equivalent",
        payment_id: paymentId,
        amount_paid: payAmount,
        audit_details: `action=resolve_replacement card_id=${id} card_book_id=${targetLcbId} resolution=paid_equivalent payment_id=${paymentId} amount=${payAmount.toFixed(2)}`,
      };
    }

    // resolution === "waived" (Admin only, verified above)
    const { error: waiveErr } = await supabase
      .from("library_card_books")
      .update({
        loan_status: "waived",
        fine_waived: true,
        fine_waived_by: session.userId,
        fine_waived_reason: reason,
        fine_waived_at: nowIso,
        replacement_resolution: "waived",
        replacement_resolved_by: session.userId,
        replacement_resolved_at: nowIso,
        replacement_resolution_reason: reason,
      })
      .eq("id", targetLcbId);
    if (waiveErr) throw mapDatabaseError(waiveErr, "Failed to waive replacement.");

    return {
      ok: true,
      id,
      card_book_id: targetLcbId,
      resolution: "waived",
      loan_status: "waived",
      audit_details: `action=resolve_replacement card_id=${id} card_book_id=${targetLcbId} resolution=waived actor_id=${session.userId}`,
    };
  }

  if (action === "waive_fine") {
    // Admin only!
    await verifyRepositoryActor(supabase, session.userId, ["admin"], session.sessionToken);
    const parsed = libraryCardWaiveFineSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "A waiver reason is required.",
        400
      );
    }

    const nowIso = new Date().toISOString();
    const waiveFields = {
      fine_waived: true,
      fine_waived_by: session.userId,
      fine_waived_reason: parsed.data.reason,
      fine_waived_at: nowIso,
    };

    if (parsed.data.return_id) {
      const { data: retRow } = await supabase
        .from("book_returns")
        .select("id")
        .eq("id", parsed.data.return_id)
        .maybeSingle();
      if (!retRow) {
        throw new AdminMutationError("Return record not found.", 404);
      }
      const { error } = await supabase
        .from("book_returns")
        .update(waiveFields)
        .eq("id", parsed.data.return_id);
      if (error) throw mapDatabaseError(error, "Failed to waive fine.");

      return {
        ok: true,
        return_id: parsed.data.return_id,
        audit_details: `action=waive_fine return_id=${parsed.data.return_id} actor_id=${session.userId}`,
      };
    }

    if (parsed.data.card_book_id) {
      const { data: lcbRow } = await supabase
        .from("library_card_books")
        .select("id")
        .eq("id", parsed.data.card_book_id)
        .maybeSingle();
      if (!lcbRow) {
        throw new AdminMutationError("Borrowed book record not found.", 404);
      }
      const { error } = await supabase
        .from("library_card_books")
        .update(waiveFields)
        .eq("id", parsed.data.card_book_id);
      if (error) throw mapDatabaseError(error, "Failed to waive fine.");

      return {
        ok: true,
        card_book_id: parsed.data.card_book_id,
        audit_details: `action=waive_fine card_book_id=${parsed.data.card_book_id} actor_id=${session.userId}`,
      };
    }

    if (!id) {
      throw new AdminMutationError("Card ID, Return ID, or Card Book ID is required.", 400);
    }

    const { data: cardExists } = await supabase
      .from("library_cards")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!cardExists) {
      throw new AdminMutationError("Card not found.", 404);
    }

    const [retWaiveRes, lcbWaiveRes] = await Promise.all([
      supabase.from("book_returns").update(waiveFields).eq("card_id", id),
      supabase.from("library_card_books").update(waiveFields).eq("card_id", id),
    ]);
    if (retWaiveRes.error) throw mapDatabaseError(retWaiveRes.error, "Failed to waive return fines.");
    if (lcbWaiveRes.error) throw mapDatabaseError(lcbWaiveRes.error, "Failed to waive loan fines.");

    return {
      ok: true,
      id,
      audit_details: `action=waive_fine card_id=${id} actor_id=${session.userId}`,
    };
  }

  if (action === "record_fine_payment") {
    const parsed = libraryCardRecordFinePaymentSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid fine payment payload.",
        400
      );
    }
    if (!id && !parsed.data.return_id && !parsed.data.card_book_id) {
      throw new AdminMutationError("Card ID, Return ID, or Card Book ID is required.", 400);
    }

    // Idempotency lookup
    const existingPayRes = await supabase
      .from("fine_payments")
      .select("id, card_id, amount_paid, payment_method, created_at")
      .eq("idempotency_key", parsed.data.idempotency_key)
      .maybeSingle();
    if (existingPayRes.error && !isMissingTableError(existingPayRes.error)) {
      throw mapDatabaseError(existingPayRes.error, "Failed to verify idempotency key.");
    }
    if (existingPayRes.data) {
      return {
        ok: true,
        idempotent_replay: true,
        payment_id: Number(existingPayRes.data.id),
        card_id: Number(existingPayRes.data.card_id),
        amount_paid: Number(existingPayRes.data.amount_paid),
        audit_details: `action=record_fine_payment replay=true key=${parsed.data.idempotency_key}`,
      };
    }

    let targetCardId = id ?? 0;
    let totalTargetFine = 0;

    if (parsed.data.return_id) {
      const { data: retRow, error: retErr } = await supabase
        .from("book_returns")
        .select("id, card_id, fine_amount, fine_paid, fine_waived")
        .eq("id", parsed.data.return_id)
        .maybeSingle();
      if (retErr) throw mapDatabaseError(retErr, "Failed to load return fine.");
      if (!retRow) throw new AdminMutationError("Return record not found.", 404);
      targetCardId = Number(retRow.card_id);
      if (!retRow.fine_paid && !retRow.fine_waived) {
        totalTargetFine = Number(retRow.fine_amount ?? 0);
      }
    } else if (parsed.data.card_book_id) {
      const { data: lcbRow, error: lcbErr } = await supabase
        .from("library_card_books")
        .select("id, card_id, fine_amount, fine_paid, fine_waived")
        .eq("id", parsed.data.card_book_id)
        .maybeSingle();
      if (lcbErr) throw mapDatabaseError(lcbErr, "Failed to load loan fine.");
      if (!lcbRow) throw new AdminMutationError("Borrowed book record not found.", 404);
      targetCardId = Number(lcbRow.card_id);
      if (!lcbRow.fine_paid && !lcbRow.fine_waived) {
        totalTargetFine = Number(lcbRow.fine_amount ?? 0);
      }
    }

    const { data: targetCard, error: cardErr } = await supabase
      .from("library_cards")
      .select("id, user_id")
      .eq("id", targetCardId)
      .maybeSingle();
    if (cardErr) throw mapDatabaseError(cardErr, "Failed to load library card.");
    if (!targetCard) throw new AdminMutationError("Card not found.", 404);

    if (!parsed.data.return_id && !parsed.data.card_book_id) {
      const [retListRes, lcbListRes] = await Promise.all([
        supabase
          .from("book_returns")
          .select("id, fine_amount, fine_paid, fine_waived")
          .eq("card_id", targetCardId),
        supabase
          .from("library_card_books")
          .select("id, fine_amount, fine_paid, fine_waived")
          .eq("card_id", targetCardId),
      ]);
      if (retListRes.error) throw mapDatabaseError(retListRes.error, "Failed to load return fines.");
      if (lcbListRes.error) throw mapDatabaseError(lcbListRes.error, "Failed to load loan fines.");

      for (const r of retListRes.data ?? []) {
        if (!r.fine_paid && !r.fine_waived) totalTargetFine += Number(r.fine_amount ?? 0);
      }
      for (const b of lcbListRes.data ?? []) {
        if (!b.fine_paid && !b.fine_waived) totalTargetFine += Number(b.fine_amount ?? 0);
      }
    }

    let payQuery = supabase
      .from("fine_payments")
      .select("id, amount_paid")
      .eq("card_id", targetCardId);
    if (parsed.data.return_id) payQuery = payQuery.eq("return_id", parsed.data.return_id);
    else if (parsed.data.card_book_id) payQuery = payQuery.eq("card_book_id", parsed.data.card_book_id);

    const prevPayRes = await payQuery;
    if (prevPayRes.error && !isMissingTableError(prevPayRes.error)) {
      throw mapDatabaseError(prevPayRes.error, "Failed to compute paid fine balance.");
    }
    const alreadyPaid = (prevPayRes.data ?? []).reduce(
      (s, p) => s + Number(p.amount_paid ?? 0),
      0
    );
    const outstanding = Number(Math.max(0, totalTargetFine - alreadyPaid).toFixed(2));
    if (outstanding <= 0) {
      throw new AdminMutationError("No unpaid fine balance remains for this record.", 409);
    }

    const payAmount = Number(parsed.data.amount.toFixed(2));
    if (payAmount > outstanding) {
      throw new AdminMutationError(
        `Payment amount (PHP ${payAmount.toFixed(2)}) exceeds outstanding fine balance (PHP ${outstanding.toFixed(2)}).`,
        400
      );
    }

    const { data: insertedPay, error: insErr } = await supabase
      .from("fine_payments")
      .insert({
        idempotency_key: parsed.data.idempotency_key,
        card_id: targetCardId,
        return_id: parsed.data.return_id ?? null,
        card_book_id: parsed.data.card_book_id ?? null,
        user_id: targetCard.user_id ?? null,
        amount_paid: payAmount,
        payment_method: parsed.data.payment_method,
        receipt_note: parsed.data.note || null,
        recorded_by: session.userId,
      })
      .select("id")
      .single();

    if (insErr) {
      const eCode = String((insErr as { code?: unknown }).code ?? "");
      if (eCode === "23505") {
        const { data: replayRow } = await supabase
          .from("fine_payments")
          .select("id, card_id, amount_paid")
          .eq("idempotency_key", parsed.data.idempotency_key)
          .maybeSingle();
        if (replayRow) {
          return {
            ok: true,
            idempotent_replay: true,
            payment_id: Number(replayRow.id),
            card_id: Number(replayRow.card_id),
            amount_paid: Number(replayRow.amount_paid),
            audit_details: `action=record_fine_payment replay=true key=${parsed.data.idempotency_key}`,
          };
        }
      }
      throw mapDatabaseError(insErr, "Failed to record fine payment.");
    }

    const remainingBalance = Number(Math.max(0, outstanding - payAmount).toFixed(2));
    const fullyPaid = remainingBalance === 0;

    if (fullyPaid) {
      if (parsed.data.return_id) {
        const { error: uErr } = await supabase
          .from("book_returns")
          .update({ fine_paid: true })
          .eq("id", parsed.data.return_id);
        if (uErr) throw mapDatabaseError(uErr, "Failed to mark return fine paid.");
      } else if (parsed.data.card_book_id) {
        const { error: uErr } = await supabase
          .from("library_card_books")
          .update({ fine_paid: true })
          .eq("id", parsed.data.card_book_id);
        if (uErr) throw mapDatabaseError(uErr, "Failed to mark loan fine paid.");
      } else {
        const [uRet, uLcb] = await Promise.all([
          supabase.from("book_returns").update({ fine_paid: true }).eq("card_id", targetCardId),
          supabase.from("library_card_books").update({ fine_paid: true }).eq("card_id", targetCardId),
        ]);
        if (uRet.error) throw mapDatabaseError(uRet.error, "Failed to mark return fines paid.");
        if (uLcb.error) throw mapDatabaseError(uLcb.error, "Failed to mark loan fines paid.");
      }
    }

    return {
      ok: true,
      payment_id: Number(insertedPay!.id),
      card_id: targetCardId,
      amount_paid: payAmount,
      remaining_balance: remainingBalance,
      fine_paid: fullyPaid,
      audit_details: `action=record_fine_payment card_id=${targetCardId} payment_id=${insertedPay!.id} amount=${payAmount.toFixed(2)} remaining=${remainingBalance.toFixed(2)} method=${parsed.data.payment_method} key=${parsed.data.idempotency_key}`,
    };
  }

  if (action === "renew") {
    if (!id) throw new AdminMutationError("Card ID is required.", 400);
    const parsed = libraryCardUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid renewal payload.",
        400
      );
    }

    const renewed = await renewLibraryCardAtomically(supabase, id, todayIso);
    return {
      ok: true,
      id: renewed.id,
      date_return: renewed.date_return,
      audit_details: `action=renew_library_card card_id=${id} date_return=${renewed.date_return}`,
    };
  }

  if (action === "update") {
    if (!id) throw new AdminMutationError("Card ID is required.", 400);
    const parsed = libraryCardUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid library card update payload.",
        400
      );
    }

    const { data: existingCard } = await supabase
      .from("library_cards")
      .select("id, user_id, card_type_category, date_issued, date_return, valid_until")
      .eq("id", id)
      .maybeSingle();
    if (!existingCard) {
      throw new AdminMutationError("Card not found.", 404);
    }

    const { data: existingCardBooks } = await supabase
      .from("library_card_books")
      .select("id, book_id, copy_id, quantity, loan_status")
      .eq("card_id", id);

    if (existingCardBooks && existingCardBooks.length > 0) {
      const hasActiveLoan = existingCardBooks.some(
        (cb) => cb.loan_status === "borrowed" || cb.loan_status === "overdue"
      );
      if (!hasActiveLoan) {
        throw new AdminMutationError("Cannot update a library card that has already been returned.", 409);
      }
    } else {
      const { data: existingReturn } = await supabase
        .from("book_returns")
        .select("id")
        .eq("card_id", id)
        .limit(1);
      if (existingReturn && existingReturn.length > 0) {
        throw new AdminMutationError("Cannot update a library card that has already been returned.", 409);
      }
    }

    const data = parsed.data;
    if (
      data.renewal1_checked !== undefined ||
      data.renewal2_checked !== undefined ||
      data.renewal1_date !== undefined ||
      data.renewal2_date !== undefined
    ) {
      throw new AdminMutationError(
        "Renewal status cannot be modified directly via update; use action 'renew'.",
        400
      );
    }

    const updateFields: Record<string, unknown> = {};
    if (data.date_return !== undefined && String(data.date_return).trim() !== "") {
      const baseIssued =
        existingCard.date_issued && isIsoDate(String(existingCard.date_issued))
          ? String(existingCard.date_issued)
          : todayIso;
      const dueCheck = validateAndResolveDueDate(data.date_return, baseIssued, todayIso);
      if (!dueCheck.ok) {
        throw new AdminMutationError(dueCheck.error, 400);
      }
      updateFields.date_return = dueCheck.dateReturn;
    }

    if (data.valid_until !== undefined) {
      const nextValidUntil = String(data.valid_until || "").trim() || null;
      if (nextValidUntil && isCardExpired(nextValidUntil, todayIso)) {
        throw new AdminMutationError("Valid-until date cannot be expired.", 400);
      }
      updateFields.valid_until = nextValidUntil;
    }

    if (data.firstname) updateFields.firstname = data.firstname;
    if (data.lastname) updateFields.lastname = data.lastname;
    if (data.phone_number !== undefined || data.phone !== undefined) {
      updateFields.phone_number = String(data.phone_number || data.phone || "").trim() || null;
    }
    if (data.address !== undefined) {
      updateFields.address = String(data.address || "").trim() || null;
    }
    if (data.card_type) {
      updateFields.card_type = data.card_type;
    }
    if (data.photo_path !== undefined) {
      updateFields.photo_path = String(data.photo_path || "").trim() || null;
    }

    if (Array.isArray(data.book_ids)) {
      const snapshots = await resolveBookSnapshots(supabase, null, null, 1, data.book_ids);
      const totalRequestedQty = snapshots.reduce((sum, s) => sum + s.qty, 0);
      if (totalRequestedQty > CIRCULATION_RULES.MAX_ACTIVE_BORROWS) {
        throw new AdminMutationError(
          `Borrow limit exceeded: maximum ${CIRCULATION_RULES.MAX_ACTIVE_BORROWS} books per loan.`,
          409
        );
      }

      const oldBooks = existingCardBooks ?? [];
      const oldLcbIds = oldBooks.map((ob) => Number(ob.id)).filter(Boolean);
      const oldActiveBooks = oldBooks.filter(
        (ob) => ob.loan_status === "borrowed" || ob.loan_status === "overdue"
      );

      const memberUid =
        existingCard.card_type_category === "member" && existingCard.user_id
          ? Number(existingCard.user_id)
          : null;

      // Claim new copies BEFORE deleting/releasing old loans so failure preserves existing state
      await borrowSnapshotsAtomically(supabase, id, snapshots, { userId: memberUid });

      const oldActiveCopyIds = oldActiveBooks
        .map((ob) => Number(ob.copy_id))
        .filter((cid) => cid > 0);
      if (oldActiveCopyIds.length > 0) {
        await supabase
          .from("book_copies")
          .update({ circulation_status: "Available" })
          .in("id", oldActiveCopyIds)
          .eq("circulation_status", "Borrowed");
      }

      if (oldLcbIds.length > 0) {
        await supabase.from("library_card_books").delete().in("id", oldLcbIds);
      }

      const oldBookIds = Array.from(
        new Set(oldActiveBooks.map((ob) => Number(ob.book_id)).filter(Boolean))
      );
      for (const bid of oldBookIds) {
        const { data: hasCopies } = await supabase
          .from("book_copies")
          .select("id")
          .eq("book_id", bid)
          .limit(1);
        if (hasCopies && hasCopies.length > 0) {
          await recomputeBookInventoryCounts(supabase, bid);
        } else {
          const oldQty = oldActiveBooks
            .filter((ob) => Number(ob.book_id) === bid)
            .reduce((s, ob) => s + Math.max(1, Number(ob.quantity ?? 1) || 1), 0);
          if (oldQty > 0) {
            const { data: inv } = await supabase
              .from("book_inventory")
              .select("id, volumes, available_copies")
              .eq("book_id", bid)
              .maybeSingle();
            if (inv) {
              await supabase
                .from("book_inventory")
                .update({
                  available_copies: Math.min(
                    Number(inv.volumes ?? oldQty),
                    Number(inv.available_copies ?? 0) + oldQty
                  ),
                })
                .eq("id", inv.id);
            }
          }
        }
      }
    }

    if (Object.keys(updateFields).length > 0) {
      const { error } = await supabase
        .from("library_cards")
        .update(updateFields)
        .eq("id", id);
      if (error) throw mapDatabaseError(error, "Failed to update library card.");
    }

    return {
      ok: true,
      id,
      audit_details: `action=update_library_card card_id=${id}`,
    };
  }

  throw new AdminMutationError(`Unknown library_cards action: ${action}`, 400);
}
