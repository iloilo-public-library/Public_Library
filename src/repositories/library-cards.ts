import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { STAFF_ROLES } from "@/config/constants";
import { safeDecryptData, safeDecryptPii } from "@/lib/crypto/fernet";
import { isbnMatches, normalizeIsbn } from "@/lib/books/isbn";
import { mapDatabaseError } from "@/lib/errors";
import { deleteFromDropbox, isDropboxConfigured } from "@/lib/storage/dropbox";
import { DROPBOX_FOLDERS } from "@/lib/storage";
import {
  CIRCULATION_RULES,
  addDaysToIsoDate,
  computeIncidentFee,
  computeOverdueDays,
  computeOverdueFine,
  getManilaTodayISO,
  validateAndResolveDueDate,
} from "@/lib/circulation/rules";
import { recomputeBookInventoryCounts } from "@/repositories/inventory";
import { AdminMutationError, formatFullName } from "@/repositories/shared";
import {
  libraryCardCreateSchema,
  libraryCardDeleteSchema,
  libraryCardMarkIncidentSchema,
  libraryCardReturnSchema,
  libraryCardUpdateSchema,
  libraryCardWaiveFineSchema,
} from "@/validators/admin";

export interface LibraryCardsQueryOptions {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  overdue?: boolean;
  from?: string;
  to?: string;
  sort?: string;
  order?: "asc" | "desc";
  sessionRole?: string | null;
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
  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, author, isbn, cost_price, is_borrowable")
    .in("id", uniqueIds);

  if (error) {
    throw mapDatabaseError(error, "Failed to look up books.");
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
    }
  >();
  for (const b of books ?? []) {
    bookMap.set(Number(b.id), b);
  }

  const snapshots: BookSnapshot[] = [];
  for (const req of requested) {
    const b = bookMap.get(req.id);
    if (!b) {
      throw new AdminMutationError(`Book #${req.id} was not found.`, 404);
    }
    const borrowable = b.is_borrowable !== false;
    if (!borrowable) {
      throw new AdminMutationError(
        `"${safeDecryptData(b.title)}" is marked as non-borrowable (Reference Only).`,
        400
      );
    }
    snapshots.push({
      book_id: Number(b.id),
      copy_id: req.copy_id,
      title: safeDecryptData(b.title),
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
      if (err instanceof AdminMutationError) throw err;
    }
  }

  // Conditional atomic UPDATE on book_copies.circulation_status = 'Available'
  const { data: claimed, error: claimErr } = await supabase
    .from("book_copies")
    .update({ circulation_status: "Borrowed" })
    .eq("id", params.copyId)
    .eq("book_id", params.bookId)
    .eq("circulation_status", "Available")
    .select("id")
    .maybeSingle();

  if (claimErr) {
    throw mapDatabaseError(claimErr, "Failed to reserve copy for borrowing.");
  }
  if (!claimed) {
    throw new AdminMutationError(
      "This book copy is no longer available for borrowing.",
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
 * Claims physical copies atomically for each requested book snapshot, rolling back
 * any copies claimed earlier in the same request if a later copy fails.
 */
async function borrowSnapshotsAtomically(
  supabase: SupabaseClient,
  cardId: number,
  snapshots: BookSnapshot[]
): Promise<{ claimedCopyIds: number[]; touchedBookIds: number[] }> {
  if (snapshots.length === 0) {
    return { claimedCopyIds: [], touchedBookIds: [] };
  }

  const claimedCopyIds: number[] = [];
  const touchedBookIds = new Set<number>();

  const rollbackClaimed = async () => {
    if (claimedCopyIds.length > 0) {
      await supabase
        .from("book_copies")
        .update({ circulation_status: "Available" })
        .in("id", claimedCopyIds);
    }
    await supabase.from("library_card_books").delete().eq("card_id", cardId);
  };

  try {
    for (const s of snapshots) {
      touchedBookIds.add(s.book_id);

      if (s.copy_id) {
        await claimCopyAtomically(supabase, {
          cardId,
          bookId: s.book_id,
          copyId: s.copy_id,
          bookTitle: s.title,
          bookAuthor: s.author,
          bookIsbn: s.isbn,
        });
        claimedCopyIds.push(s.copy_id);
        continue;
      }

      // Check whether this book has tracked rows in book_copies
      const { data: anyCopies } = await supabase
        .from("book_copies")
        .select("id, circulation_status")
        .eq("book_id", s.book_id)
        .order("copy_number", { ascending: true })
        .limit(500);

      if (anyCopies && anyCopies.length > 0) {
        const availableCandidates = anyCopies.filter(
          (c) => String(c.circulation_status) === "Available"
        );
        if (availableCandidates.length < s.qty) {
          throw new AdminMutationError(
            `Only ${availableCandidates.length} available copy/copies left for "${s.title}".`,
            409
          );
        }

        let claimedForBook = 0;
        for (const cand of availableCandidates) {
          if (claimedForBook >= s.qty) break;
          try {
            await claimCopyAtomically(supabase, {
              cardId,
              bookId: s.book_id,
              copyId: Number(cand.id),
              bookTitle: s.title,
              bookAuthor: s.author,
              bookIsbn: s.isbn,
            });
            claimedCopyIds.push(Number(cand.id));
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
        if (inv && currentAvail < s.qty) {
          throw new AdminMutationError(
            `Only ${currentAvail} available copy/copies left for "${s.title}".`,
            409
          );
        }

        if (inv) {
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
        }

        const { error: lcbErr } = await supabase.from("library_card_books").insert({
          card_id: cardId,
          book_id: s.book_id,
          book_title: s.title,
          book_author: s.author,
          book_isbn: s.isbn,
          quantity: s.qty,
          loan_status: "borrowed",
        });
        if (lcbErr) {
          throw mapDatabaseError(lcbErr, "Failed to record borrowed book.");
        }
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

  if (submittedValidUntil && submittedValidUntil < todayIso) {
    throw new AdminMutationError("Member library card is expired.", 400);
  }

  const { data: existingCards } = await supabase
    .from("library_cards")
    .select("id, valid_until, date_return")
    .eq("user_id", userId)
    .order("id", { ascending: false })
    .limit(100);

  const cards = existingCards ?? [];
  if (!submittedValidUntil && cards.length > 0) {
    const latestValidUntil = String(cards[0]?.valid_until ?? "").trim();
    if (latestValidUntil && latestValidUntil < todayIso) {
      throw new AdminMutationError(
        "Member library card is expired. Please renew the card before borrowing.",
        400
      );
    }
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

  const cardIds = cards.map((c) => Number(c.id));
  const [activeLoansRes, returnsRes] = await Promise.all([
    supabase
      .from("library_card_books")
      .select("id, card_id, quantity, loan_status, fine_amount, fine_paid, fine_waived")
      .in("card_id", cardIds),
    supabase
      .from("book_returns")
      .select("id, card_id, fine_amount, fine_paid, fine_waived")
      .in("card_id", cardIds),
  ]);

  const returnedCardIds = new Set<number>(
    (returnsRes.data ?? []).map((r) => Number(r.card_id))
  );

  let activeBorrowedCount = 0;
  let unpaidFines = 0;

  for (const lcb of activeLoansRes.data ?? []) {
    const status = String(lcb.loan_status ?? "borrowed");
    const isActive =
      (status === "borrowed" || status === "overdue") &&
      !returnedCardIds.has(Number(lcb.card_id));
    if (isActive) {
      activeBorrowedCount += Math.max(1, Number(lcb.quantity ?? 1) || 1);
    }
    const fine = Number(lcb.fine_amount ?? 0);
    if (fine > 0 && !lcb.fine_paid && !lcb.fine_waived) {
      unpaidFines += fine;
    }
  }

  for (const ret of returnsRes.data ?? []) {
    const fine = Number(ret.fine_amount ?? 0);
    if (fine > 0 && !ret.fine_paid && !ret.fine_waived) {
      unpaidFines += fine;
    }
  }

  if (unpaidFines >= CIRCULATION_RULES.BLOCKING_UNPAID_FINE_PHP) {
    throw new AdminMutationError(
      `Member has unpaid fines of PHP ${unpaidFines.toFixed(2)} blocking new borrows.`,
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
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(options.pageSize ?? MAX_PAGE_SIZE))
  );
  const q = (options.q ?? "").trim().toLowerCase();
  const statusFilter = (options.status ?? "").trim().toLowerCase();
  const fromDate = (options.from ?? "").trim();
  const toDate = (options.to ?? "").trim();
  const sortField = (options.sort ?? "id").trim().toLowerCase();
  const sortAsc = options.order === "asc";
  const isLibrarian = options.sessionRole === "librarian";
  const todayIso = getManilaTodayISO();

  const [cardsRes, cardBooksRes, returnsRes] = await Promise.all([
    supabase
      .from("library_cards")
      .select(
        "id, card_type_category, user_id, firstname, lastname, phone_number, address, date_issued, date_return, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date, card_type, valid_until, photo_path, registered_by, created_at"
      )
      .order("id", { ascending: false })
      .limit(DB_FETCH_CAP),
    supabase
      .from("library_card_books")
      .select(
        "id, card_id, book_id, copy_id, book_title, book_author, book_isbn, quantity, loan_status, fine_amount, fine_paid, fine_waived"
      )
      .limit(DB_FETCH_CAP * 4),
    supabase
      .from("book_returns")
      .select("id, card_id, return_date, overdue_days, fine_amount, fine_paid, fine_waived")
      .limit(DB_FETCH_CAP),
  ]);
  if (cardsRes.error) throw mapDatabaseError(cardsRes.error, "Failed to load borrow records.");

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

  const returnByCard = new Map<number, Record<string, unknown>>();
  for (const r of returnsRes.data ?? []) {
    returnByCard.set(Number(r.card_id), r);
  }

  const booksByCard = new Map<number, Record<string, unknown>[]>();
  for (const cb of cardBooksRes.data ?? []) {
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

  let rows = (cardsRes.data ?? []).map((c) => {
    const cid = Number(c.id);
    const cardBooks = booksByCard.get(cid) ?? [];
    const ret = returnByCard.get(cid);
    const isReturned = Boolean(ret);
    const fn = safeDecryptPii(c.firstname);
    const ln = safeDecryptPii(c.lastname);
    const rawPhoto = c.photo_path ? String(c.photo_path).replace(/\\/g, "/") : "";
    const photoUrl = rawPhoto
      ? rawPhoto.startsWith("/") || rawPhoto.startsWith("http")
        ? rawPhoto
        : `/${rawPhoto}`
      : "";

    const overdueDays = isReturned
      ? Number(ret?.overdue_days ?? computeOverdueDays(c.date_return, String(ret?.return_date ?? todayIso)))
      : computeOverdueDays(c.date_return, todayIso);
    const storedFine =
      Number(ret?.fine_amount ?? 0) +
      cardBooks.reduce((s, b) => s + Number(b.fine_amount ?? 0), 0);
    const fineAmount = isReturned
      ? storedFine
      : Math.max(storedFine, computeOverdueFine(overdueDays));
    const fineWaived = Boolean(ret?.fine_waived) || cardBooks.some((b) => Boolean(b.fine_waived));
    const status = isReturned ? "returned" : overdueDays > 0 ? "overdue" : "active";

    // Librarians have read-only patron access without member contact PII
    const redactMemberPii = isLibrarian && c.card_type_category === "member";

    return {
      ...c,
      type: c.card_type_category,
      firstname: fn,
      lastname: ln,
      fullname: formatFullName(c.firstname, c.lastname),
      phone_number: redactMemberPii ? "" : safeDecryptPii(c.phone_number),
      address: redactMemberPii ? "" : safeDecryptPii(c.address),
      photo_url: photoUrl,
      registered_by_name:
        typeof c.registered_by === "number"
          ? (staffMap.get(c.registered_by) ?? "—")
          : "—",
      books: cardBooks,
      books_count: cardBooks.reduce((s, b) => s + Number(b.quantity ?? 1), 0),
      is_returned: isReturned,
      status,
      overdue_days: overdueDays,
      fine_amount: fineWaived ? 0 : fineAmount,
      fine_waived: fineWaived,
    };
  });

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
      const hay = `${r.fullname} ${r.phone_number} ${r.books
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
  await verifyRepositoryActor(supabase, session.userId, STAFF_ROLES);
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
      .select("book_id, copy_id, loan_status")
      .eq("card_id", id);

    const activeCopyIds = (cardBooks ?? [])
      .filter((cb) => cb.copy_id && (cb.loan_status === "borrowed" || cb.loan_status === "overdue"))
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
      await recomputeBookInventoryCounts(supabase, bid);
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
    const dateIssued = String(data.date_issued || "").trim() || todayIso;

    const dueCheck = validateAndResolveDueDate(data.date_return, dateIssued, todayIso);
    if (!dueCheck.ok) {
      throw new AdminMutationError(dueCheck.error, 400);
    }
    const resolvedDateReturn = dueCheck.dateReturn;

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

    // Server-side member eligibility checks (card expiry, borrow limit, unpaid fines)
    if (category === "member" && data.user_id) {
      await assertMemberBorrowEligibility(
        supabase,
        Number(data.user_id),
        totalRequestedQty,
        validUntil,
        todayIso
      );
    }

    const { data: card, error } = await supabase
      .from("library_cards")
      .insert({
        card_type_category: category,
        user_id: category === "member" && data.user_id ? Number(data.user_id) : null,
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
      await borrowSnapshotsAtomically(supabase, newCardId, snapshots);
    } catch (borrowErr) {
      // Roll back the newly created library_cards record so no orphan card remains
      await supabase.from("library_cards").delete().eq("id", newCardId);
      throw borrowErr;
    }

    return {
      ok: true,
      id: newCardId,
      date_return: resolvedDateReturn,
      audit_details: `action=borrow card_id=${newCardId} category=${category} books=${totalRequestedQty}`,
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

    const returnDate = String(parsed.data.return_date || "").trim() || todayIso;

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

    const itemsToReturn: Array<{
      cb: Record<string, unknown>;
      qtyReturned: number;
      returnCondition: string;
      conditionNotes: string;
    }> = [];

    if (Array.isArray(parsed.data.items) && parsed.data.items.length > 0) {
      for (const item of parsed.data.items) {
        const qtyReturned = Math.max(0, Number(item.qty_returned ?? 0) || 0);
        if (qtyReturned <= 0) continue;

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
        if (matchedCb) {
          itemsToReturn.push({
            cb: matchedCb,
            qtyReturned,
            returnCondition: item.return_condition ?? "Good",
            conditionNotes: item.condition_notes ?? "",
          });
        }
      }
    } else {
      for (const cb of cardBooks) {
        itemsToReturn.push({
          cb,
          qtyReturned: Math.max(1, Number(cb.quantity ?? 1) || 1),
          returnCondition: "Good",
          conditionNotes: "",
        });
      }
    }

    // Server-side overdue & fine computation in Asia/Manila (never trust client!)
    const overdueDays = computeOverdueDays(existingCard.date_return, returnDate);
    const totalQtyReturned = itemsToReturn.reduce((sum, it) => sum + it.qtyReturned, 0);
    const fineAmount = Number(
      (computeOverdueFine(overdueDays) * Math.max(1, totalQtyReturned)).toFixed(2)
    );
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
      // Graceful fallback if migration 011 columns are not yet applied
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

    for (const { cb, qtyReturned, returnCondition, conditionNotes } of itemsToReturn) {
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
        await supabase.from("book_return_items").insert(baseItem);
      }

      const lcbUpd = await supabase
        .from("library_card_books")
        .update({ loan_status: "returned", returned_at: nowIso })
        .eq("id", cb.id);
      if (lcbUpd.error) {
        await supabase
          .from("library_card_books")
          .update({ loan_status: "returned" })
          .eq("id", cb.id);
      }

      if (cb.copy_id) {
        const isUnusable =
          returnCondition === "Damaged" ||
          returnCondition === "Destroyed" ||
          returnCondition === "Lost";
        await supabase
          .from("book_copies")
          .update({
            circulation_status: isUnusable ? "Unusable" : "Available",
            condition: returnCondition,
            ...(conditionNotes ? { condition_notes: conditionNotes } : {}),
          })
          .eq("id", Number(cb.copy_id));
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
        const returnedForBook = itemsToReturn
          .filter((it) => Number(it.cb.book_id) === bid)
          .reduce((s, it) => s + it.qtyReturned, 0);
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
                Number(inv.volumes ?? returnedForBook),
                Number(inv.available_copies ?? 0) + returnedForBook
              ),
            })
            .eq("id", inv.id);
        }
      }
    }

    return {
      ok: true,
      returnId: retRow!.id,
      return_id: retRow!.id,
      overdue_days: overdueDays,
      fine_amount: fineAmount,
      audit_details: `action=return_books card_id=${id} return_id=${retRow!.id} overdue_days=${overdueDays} fine=${fineAmount}`,
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

    const { data: cardBooks } = await supabase
      .from("library_card_books")
      .select("id, card_id, book_id, copy_id, loan_status")
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
      throw new AdminMutationError("Borrowed book entry not found on this card.", 404);
    }

    let bookCostPrice: number | null = null;
    if (targetLcb.book_id) {
      const { data: bookRow } = await supabase
        .from("books")
        .select("cost_price")
        .eq("id", Number(targetLcb.book_id))
        .maybeSingle();
      if (bookRow?.cost_price !== undefined && bookRow?.cost_price !== null) {
        bookCostPrice = Number(bookRow.cost_price);
      }
    }

    const feeAmount = computeIncidentFee(kind, bookCostPrice);
    const reasonText = parsed.data.reason;
    const notesText = parsed.data.condition_notes || reasonText;
    const copyIdToUpdate = parsed.data.copy_id ?? (targetLcb.copy_id ? Number(targetLcb.copy_id) : null);

    if (copyIdToUpdate) {
      await supabase
        .from("book_copies")
        .update({
          condition: targetCondition,
          circulation_status: "Unusable",
          condition_notes: notesText,
        })
        .eq("id", copyIdToUpdate);
    }

    const lcbUpdate = await supabase
      .from("library_card_books")
      .update({
        loan_status: kind === "lost" ? "lost" : "returned",
        fine_amount: feeAmount,
        incident_reason: reasonText,
      })
      .eq("id", Number(targetLcb.id));

    if (lcbUpdate.error) {
      await supabase
        .from("library_card_books")
        .update({ loan_status: kind === "lost" ? "lost" : "returned" })
        .eq("id", Number(targetLcb.id));
    }

    if (targetLcb.book_id) {
      await recomputeBookInventoryCounts(supabase, Number(targetLcb.book_id));
    }

    return {
      ok: true,
      id,
      card_book_id: Number(targetLcb.id),
      copy_id: copyIdToUpdate,
      fee_amount: feeAmount,
      audit_details: `action=${action} card_id=${id} card_book_id=${targetLcb.id} fee=${feeAmount}`,
    };
  }

  if (action === "waive_fine") {
    // Admin only!
    await verifyRepositoryActor(supabase, session.userId, ["admin"]);
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

    await Promise.all([
      supabase.from("book_returns").update(waiveFields).eq("card_id", id),
      supabase.from("library_card_books").update(waiveFields).eq("card_id", id),
    ]);

    return {
      ok: true,
      id,
      audit_details: `action=waive_fine card_id=${id} actor_id=${session.userId}`,
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

    const { data: existingCard } = await supabase
      .from("library_cards")
      .select("id, date_return, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date")
      .eq("id", id)
      .maybeSingle();
    if (!existingCard) {
      throw new AdminMutationError("Card not found.", 404);
    }

    // Refuse if already returned
    const { data: existingReturn } = await supabase
      .from("book_returns")
      .select("id")
      .eq("card_id", id)
      .limit(1);
    if (existingReturn && existingReturn.length > 0) {
      throw new AdminMutationError("Cannot renew a loan that has already been returned.", 409);
    }

    // Enforce renewal limit (max 2 renewals)
    if (existingCard.renewal1_checked && existingCard.renewal2_checked) {
      throw new AdminMutationError(
        `Maximum renewals (${CIRCULATION_RULES.MAX_RENEWALS}) have already been used for this loan.`,
        409
      );
    }

    // Refuse if overdue
    if (computeOverdueDays(existingCard.date_return, todayIso) > 0) {
      throw new AdminMutationError(
        "Cannot renew an overdue loan. Please return the book and settle any overdue fine first.",
        409
      );
    }

    // Refuse if any copy on this card (or book with no other available copy) is reserved
    const { data: cardBooks } = await supabase
      .from("library_card_books")
      .select("book_id, copy_id")
      .eq("card_id", id);

    const copyIds = (cardBooks ?? []).map((cb) => Number(cb.copy_id)).filter(Boolean);
    const bookIds = Array.from(
      new Set((cardBooks ?? []).map((cb) => Number(cb.book_id)).filter(Boolean))
    );

    if (copyIds.length > 0) {
      const { data: reservedSelf } = await supabase
        .from("book_copies")
        .select("id")
        .in("id", copyIds)
        .eq("circulation_status", "Reserved")
        .limit(1);
      if (reservedSelf && reservedSelf.length > 0) {
        throw new AdminMutationError("Cannot renew because this copy is reserved.", 409);
      }
    }
    if (bookIds.length > 0) {
      const { data: reservedOthers } = await supabase
        .from("book_copies")
        .select("id")
        .in("book_id", bookIds)
        .eq("circulation_status", "Reserved")
        .limit(1);
      if (reservedOthers && reservedOthers.length > 0) {
        throw new AdminMutationError(
          "Cannot renew because another patron has reserved a copy of this book.",
          409
        );
      }
    }

    const baseDate =
      existingCard.date_return && String(existingCard.date_return) >= todayIso
        ? String(existingCard.date_return)
        : todayIso;
    const nextDateReturn =
      String(parsed.data.date_return || "").trim() ||
      addDaysToIsoDate(baseDate, CIRCULATION_RULES.RENEWAL_EXTENSION_DAYS);

    if (nextDateReturn < todayIso) {
      throw new AdminMutationError("Renewed due date cannot be in the past.", 400);
    }

    const nextRen1Checked = true;
    const nextRen1Date = existingCard.renewal1_checked ? existingCard.renewal1_date : todayIso;
    const nextRen2Checked = Boolean(existingCard.renewal1_checked);
    const nextRen2Date = existingCard.renewal1_checked ? todayIso : existingCard.renewal2_date;

    const { error } = await supabase
      .from("library_cards")
      .update({
        date_return: nextDateReturn,
        renewal1_checked: nextRen1Checked,
        renewal1_date: nextRen1Date,
        renewal2_checked: nextRen2Checked,
        renewal2_date: nextRen2Date,
      })
      .eq("id", id);

    if (error) throw mapDatabaseError(error, "Failed to renew loan.");

    return {
      ok: true,
      id,
      date_return: nextDateReturn,
      audit_details: `action=renew_library_card card_id=${id} date_return=${nextDateReturn}`,
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
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!existingCard) {
      throw new AdminMutationError("Card not found.", 404);
    }

    const data = parsed.data;
    const updateFields: Record<string, unknown> = {
      date_return: String(data.date_return || "").trim() || null,
      valid_until: String(data.valid_until || "").trim() || null,
      renewal1_checked: Boolean(
        data.renewal1_checked === true ||
          data.renewal1_checked === "1" ||
          data.renewal1_checked === 1
      ),
      renewal1_date: String(data.renewal1_date || "").trim() || null,
      renewal2_checked: Boolean(
        data.renewal2_checked === true ||
          data.renewal2_checked === "1" ||
          data.renewal2_checked === 1
      ),
      renewal2_date: String(data.renewal2_date || "").trim() || null,
    };

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

    const { error } = await supabase
      .from("library_cards")
      .update(updateFields)
      .eq("id", id);
    if (error) throw mapDatabaseError(error, "Failed to update library card.");

    if (Array.isArray(data.book_ids)) {
      const { data: oldBooks } = await supabase
        .from("library_card_books")
        .select("book_id, copy_id, quantity")
        .eq("card_id", id);

      const oldCopyIds = (oldBooks ?? []).map((ob) => Number(ob.copy_id)).filter(Boolean);
      if (oldCopyIds.length > 0) {
        await supabase
          .from("book_copies")
          .update({ circulation_status: "Available" })
          .in("id", oldCopyIds);
      }

      await supabase.from("library_card_books").delete().eq("card_id", id);
      const snapshots = await resolveBookSnapshots(supabase, null, null, 1, data.book_ids);
      await borrowSnapshotsAtomically(supabase, id, snapshots);
    }

    return {
      ok: true,
      id,
      audit_details: `action=update_library_card card_id=${id}`,
    };
  }

  throw new AdminMutationError(`Unknown library_cards action: ${action}`, 400);
}
