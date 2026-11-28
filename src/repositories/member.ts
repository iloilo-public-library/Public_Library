import type { SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { SessionPayload } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { safeDecryptData, safeDecryptPii } from "@/lib/crypto/fernet";
import {
  CIRCULATION_RULES,
  computeOverdueDays,
  computeOverdueFine,
  getManilaTodayISO,
  isCardExpired,
} from "@/lib/circulation/rules";
import { loadLibraryHolidayDateSet } from "@/repositories/holidays";
import {
  computeMemberUnpaidFineBalance,
  hasBlockingReservationForCard,
} from "@/repositories/library-cards";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  mapDatabaseError,
} from "@/lib/errors";
import { DROPBOX_FOLDERS } from "@/lib/storage";
import { formatFullName, resolveEmail } from "@/repositories/shared";
import type { UserSettingsMutationInput } from "@/validators/user";

const PIN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

async function verifyMemberActor(
  supabase: SupabaseClient,
  userId: number,
  sessionToken?: string | null
) {
  return verifyRepositoryActor(supabase, userId, ["user"], sessionToken);
}

export async function getMemberBorrowedBooks(
  supabase: SupabaseClient,
  userId: number,
  sessionToken?: string | null
) {
  await verifyMemberActor(supabase, userId, sessionToken);

  const [cardsRes, pendingRenewRes] = await Promise.all([
    supabase
      .from("library_cards")
      .select(
        "id, card_type_category, card_type, firstname, lastname, date_issued, date_return, valid_until, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date, created_at"
      )
      .eq("user_id", userId)
      .order("id", { ascending: false }),
    supabase
      .from("account_requests")
      .select("id, card_id, status, created_at")
      .eq("user_id", userId)
      .eq("request_type", "renew")
      .eq("status", "pending"),
  ]);

  if (cardsRes.error) throw mapDatabaseError(cardsRes.error, "Failed to load borrowed books.");
  const cards = cardsRes.data ?? [];
  if (cards.length === 0) {
    return { cards: [], borrowedBooks: [] };
  }

  const cardIds = cards.map((c) => Number(c.id));
  const holidayDates = await loadLibraryHolidayDateSet(supabase);
  const [booksRes, returnsRes, unpaidRes] = await Promise.all([
    supabase
      .from("library_card_books")
      .select(
        "id, card_id, book_id, copy_id, book_title, book_author, book_isbn, quantity, loan_status, fine_amount, fine_paid, fine_waived, added_at"
      )
      .in("card_id", cardIds)
      .order("id", { ascending: false }),
    supabase
      .from("book_returns")
      .select("id, card_id, return_date, overdue_days, fine_amount, fine_paid, fine_waived")
      .in("card_id", cardIds),
    computeMemberUnpaidFineBalance(supabase, userId, getManilaTodayISO(), {
      preloadedCards: cards as Array<Record<string, unknown>>,
      includeLiveOverdue: false,
      holidayDates,
    }),
  ]);

  if (booksRes.error) throw mapDatabaseError(booksRes.error, "Failed to load borrowed book items.");

  const returnsByCard = new Map<number, Array<Record<string, unknown>>>();
  for (const r of (returnsRes.data ?? []) as Array<Record<string, unknown>>) {
    const cid = Number(r.card_id);
    const list = returnsByCard.get(cid) ?? [];
    list.push(r);
    returnsByCard.set(cid, list);
  }
  const pendingRenewCardIds = new Set<number>(
    (pendingRenewRes.data ?? []).map((r) => Number(r.card_id)).filter(Boolean)
  );

  // Check for reserved copies on active loans (blocking ONLY when borrowed copy itself is Reserved
  // OR another copy is Reserved and zero Good/Fair Available copies of that book_id remain)
  const activeCopyIds = Array.from(
    new Set(
      (booksRes.data ?? [])
        .filter((b) => {
          const ls = String((b as Record<string, unknown>).loan_status ?? "borrowed");
          const cardReturns = returnsByCard.get(Number(b.card_id)) ?? [];
          return (ls === "borrowed" || ls === "overdue") && (b.loan_status !== undefined || cardReturns.length === 0);
        })
        .map((b) => Number(b.copy_id))
        .filter(Boolean)
    )
  );
  const activeBookIds = Array.from(
    new Set(
      (booksRes.data ?? [])
        .filter((b) => {
          const ls = String((b as Record<string, unknown>).loan_status ?? "borrowed");
          const cardReturns = returnsByCard.get(Number(b.card_id)) ?? [];
          return (ls === "borrowed" || ls === "overdue") && (b.loan_status !== undefined || cardReturns.length === 0);
        })
        .map((b) => Number(b.book_id))
        .filter(Boolean)
    )
  );

  const reservedCopyIds = new Set<number>();
  const blockedBookIds = new Set<number>();

  if (activeCopyIds.length > 0 || activeBookIds.length > 0) {
    const [resSelf, copiesForBooks] = await Promise.all([
      activeCopyIds.length > 0
        ? supabase
            .from("book_copies")
            .select("id")
            .in("id", activeCopyIds)
            .eq("circulation_status", "Reserved")
        : Promise.resolve({ data: [] as Array<{ id: number }> }),
      activeBookIds.length > 0
        ? supabase
            .from("book_copies")
            .select("id, book_id, circulation_status, condition")
            .in("book_id", activeBookIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    ]);

    for (const r of resSelf.data ?? []) {
      reservedCopyIds.add(Number(r.id));
    }
    const allBookCopies = (copiesForBooks.data ?? []) as Array<Record<string, unknown>>;
    for (const bid of activeBookIds) {
      const copies = allBookCopies.filter((c) => Number(c.book_id) === bid);
      const hasReserved = copies.some((c) => String(c.circulation_status) === "Reserved");
      if (!hasReserved) continue;
      const hasAvailable = copies.some((c) => {
        const cond = String(c.condition ?? "Good");
        return String(c.circulation_status) === "Available" && (cond === "Good" || cond === "Fair");
      });
      if (!hasAvailable) {
        blockedBookIds.add(bid);
      }
    }
  }

  const booksByCard = new Map<number, Record<string, unknown>[]>();
  const rawBooksByCard = new Map<number, Array<{ book_id: number; copy_id: number; loan_status: string }>>();
  for (const b of (booksRes.data ?? []) as Array<Record<string, unknown>>) {
    const cid = Number(b.card_id);
    const ls = String(b.loan_status ?? "borrowed");
    const list = booksByCard.get(cid) ?? [];
    list.push({
      id: b.id,
      card_id: cid,
      book_id: b.book_id,
      book_title: safeDecryptData(b.book_title),
      book_author: safeDecryptData(b.book_author),
      book_isbn: safeDecryptData(b.book_isbn),
      quantity: Number(b.quantity ?? 1),
      loan_status: ls,
      fine_amount: b.fine_waived || b.fine_paid ? 0 : Number(b.fine_amount ?? 0),
      added_at: b.added_at,
    });
    booksByCard.set(cid, list);

    const rawList = rawBooksByCard.get(cid) ?? [];
    rawList.push({
      book_id: Number(b.book_id),
      copy_id: Number(b.copy_id),
      loan_status: ls,
    });
    rawBooksByCard.set(cid, rawList);
  }

  const today = getManilaTodayISO();
  const hasBlockingUnpaidFine = unpaidRes.storedUnpaid >= CIRCULATION_RULES.BLOCKING_UNPAID_FINE_PHP;
  const memberHasReplacementPending = unpaidRes.pendingReplacementCount > 0;

  const formattedCards = cards.map((c) => {
    const cid = Number(c.id);
    const cardBooks = booksByCard.get(cid) ?? [];
    const rawCardBooks = rawBooksByCard.get(cid) ?? [];
    const cardReturns = returnsByCard.get(cid) ?? [];
    const latestRet = cardReturns[cardReturns.length - 1];

    const hasActiveBook =
      cardBooks.length > 0
        ? rawCardBooks.some((b) => b.loan_status === "borrowed" || b.loan_status === "overdue")
        : cardReturns.length === 0;
    const hasLostBook = rawCardBooks.some((b) => b.loan_status === "lost");
    const hasReplacementPending = rawCardBooks.some(
      (b) => b.loan_status === "replacement_pending"
    );
    const isReturned =
      cardBooks.length > 0
        ? !hasActiveBook && !hasLostBook && !hasReplacementPending
        : cardReturns.length > 0;
    const hasPendingRenewal = pendingRenewCardIds.has(cid);
    const overdueDays = isReturned
      ? Number(
          latestRet?.overdue_days ??
            computeOverdueDays(
              c.date_return,
              String(latestRet?.return_date ?? today),
              holidayDates
            )
        )
      : hasActiveBook || cardBooks.length === 0
        ? computeOverdueDays(c.date_return, today, holidayDates)
        : Number(latestRet?.overdue_days ?? 0);
    const isOverdue = !isReturned && hasActiveBook && overdueDays > 0;
    const cardExpired = isCardExpired(c.valid_until, today);
    const activeQty = cardBooks
      .filter((b) => b.loan_status === "borrowed" || b.loan_status === "overdue")
      .reduce((s, b) => s + Math.max(1, Number(b.quantity ?? 1) || 1), 0);

    const storedUnpaidCardFine =
      cardReturns.reduce(
        (s, r) => (r.fine_waived || r.fine_paid ? s : s + Number(r.fine_amount ?? 0)),
        0
      ) +
      cardBooks.reduce((s, b) => s + Number(b.fine_amount ?? 0), 0);
    const liveOverdueFine = isOverdue ? computeOverdueFine(overdueDays, Math.max(1, activeQty || 1)) : 0;
    const fineAmount = Number(
      (storedUnpaidCardFine + (liveOverdueFine > 0 && storedUnpaidCardFine === 0 ? liveOverdueFine : 0)).toFixed(2)
    );

    const loanStatus = isReturned
      ? "returned"
      : !hasActiveBook && hasReplacementPending
        ? "replacement_pending"
        : !hasActiveBook && hasLostBook
          ? "lost"
          : isOverdue
            ? "overdue"
            : "borrowed";

    const hasReservedCopy = rawCardBooks.some(
      (b) =>
        (b.loan_status === "borrowed" || b.loan_status === "overdue") &&
        ((b.copy_id && reservedCopyIds.has(b.copy_id)) || (b.book_id && blockedBookIds.has(b.book_id)))
    );

    let renewBlockReason: string | null = null;
    if (isReturned || loanStatus === "lost") renewBlockReason = "returned";
    else if (hasReplacementPending || memberHasReplacementPending)
      renewBlockReason = "replacement_pending";
    else if (hasPendingRenewal) renewBlockReason = "pending_renewal";
    else if (cardExpired) renewBlockReason = "expired";
    else if (isOverdue) renewBlockReason = "overdue";
    else if (hasBlockingUnpaidFine) renewBlockReason = "unpaid_fines";
    else if (Boolean(c.renewal2_checked) || (Boolean(c.renewal1_checked) && Boolean(c.renewal2_checked)))
      renewBlockReason = "max_renewals";
    else if (hasReservedCopy) renewBlockReason = "reserved";

    const canRenew = renewBlockReason === null;

    return {
      id: cid,
      card_type_category: c.card_type_category,
      card_type: c.card_type || "regular",
      fullname: formatFullName(c.firstname, c.lastname),
      date_issued: c.date_issued,
      date_return: c.date_return,
      valid_until: c.valid_until,
      renewal1_checked: Boolean(c.renewal1_checked),
      renewal1_date: c.renewal1_date,
      renewal2_checked: Boolean(c.renewal2_checked),
      renewal2_date: c.renewal2_date,
      is_returned: isReturned,
      has_replacement_pending: hasReplacementPending,
      loan_status: loanStatus,
      overdue_days: overdueDays,
      fine_amount: fineAmount,
      has_pending_renewal: hasPendingRenewal,
      can_renew: canRenew,
      renew_block_reason: renewBlockReason,
      books: cardBooks,
    };
  });

  const activeBorrowedBooks = formattedCards
    .filter((c) => !c.is_returned && c.loan_status !== "lost" && c.loan_status !== "replacement_pending")
    .flatMap((c) =>
      c.books
        .filter((b) => b.loan_status === "borrowed" || b.loan_status === "overdue")
        .map((b) => ({
          ...b,
          date_issued: c.date_issued,
          date_return: c.date_return,
          card_type_category: c.card_type_category,
          loan_status: c.loan_status === "overdue" ? "overdue" : String(b.loan_status ?? "borrowed"),
          overdue_days: c.overdue_days,
          fine_amount: c.fine_amount,
          can_renew: c.can_renew,
          renew_block_reason: c.renew_block_reason,
          has_pending_renewal: c.has_pending_renewal,
        }))
    );

  return { cards: formattedCards, borrowedBooks: activeBorrowedBooks };
}

export async function getMemberReturnHistory(
  supabase: SupabaseClient,
  userId: number,
  sessionToken?: string | null
) {
  await verifyMemberActor(supabase, userId, sessionToken);

  const { data: cards, error: cardsErr } = await supabase
    .from("library_cards")
    .select("id, card_type_category, date_issued")
    .eq("user_id", userId);

  if (cardsErr) throw mapDatabaseError(cardsErr, "Failed to load return history.");
  if (!cards || cards.length === 0) return { returns: [] };

  const cardIds = cards.map((c) => Number(c.id));
  const cardMap = new Map<number, { card_type_category: string; date_issued: string }>();
  for (const c of cards) {
    cardMap.set(Number(c.id), {
      card_type_category: String(c.card_type_category ?? "member"),
      date_issued: String(c.date_issued ?? ""),
    });
  }

  const { data: returnsData, error: retErr } = await supabase
    .from("book_returns")
    .select("id, card_id, return_date, overdue_days, fine_amount, fine_paid, fine_waived, created_at")
    .in("card_id", cardIds)
    .order("return_date", { ascending: false });

  if (retErr) throw mapDatabaseError(retErr, "Failed to load return records.");
  if (!returnsData || returnsData.length === 0) return { returns: [] };

  const returnIds = returnsData.map((r) => Number(r.id));
  const { data: itemsData, error: itemsErr } = await supabase
    .from("book_return_items")
    .select("id, return_id, card_book_id, book_title, book_author, book_isbn, qty_returned, return_condition")
    .in("return_id", returnIds)
    .order("id", { ascending: false });

  if (itemsErr) throw mapDatabaseError(itemsErr, "Failed to load returned book items.");

  const retMap = new Map<
    number,
    {
      card_id: number;
      return_date: string;
      overdue_days: number;
      fine_amount: number;
      fine_paid: boolean;
      fine_waived: boolean;
      created_at: string;
    }
  >();
  for (const r of returnsData) {
    const waived = Boolean(r.fine_waived);
    retMap.set(Number(r.id), {
      card_id: Number(r.card_id),
      return_date: String(r.return_date ?? ""),
      overdue_days: Number(r.overdue_days ?? 0),
      fine_amount: waived ? 0 : Number(r.fine_amount ?? 0),
      fine_paid: Boolean(r.fine_paid),
      fine_waived: waived,
      created_at: String(r.created_at ?? ""),
    });
  }

  const returns = (itemsData ?? []).map((item) => {
    const ret = retMap.get(Number(item.return_id));
    const card = ret ? cardMap.get(ret.card_id) : undefined;
    const cond = String(item.return_condition ?? "Good");
    return {
      id: item.id,
      return_id: item.return_id,
      card_id: ret?.card_id ?? null,
      card_type_category: card?.card_type_category ?? "member",
      date_issued: card?.date_issued ?? "",
      return_date: ret?.return_date ?? "",
      loan_status: cond === "Lost" ? "lost" : "returned",
      overdue_days: ret?.overdue_days ?? 0,
      fine_amount: ret?.fine_amount ?? 0,
      fine_paid: ret?.fine_paid ?? false,
      fine_waived: ret?.fine_waived ?? false,
      return_condition: cond,
      book_title: safeDecryptData(item.book_title),
      book_author: safeDecryptData(item.book_author),
      book_isbn: safeDecryptData(item.book_isbn),
      qty_returned: Number(item.qty_returned ?? 1),
    };
  });

  returns.sort((a, b) => {
    const cmp = b.return_date.localeCompare(a.return_date);
    return cmp !== 0 ? cmp : Number(b.id) - Number(a.id);
  });

  return { returns };
}

export async function requestMemberCardRenewal(
  supabase: SupabaseClient,
  session: SessionPayload,
  cardId: number,
  reason: string,
  clientIp = "127.0.0.1"
) {
  await verifyMemberActor(supabase, session.userId, session.sessionToken);

  await enforceRateLimit(
    {
      scope: "user:renew",
      identifier: `${clientIp}:${session.userId}`,
      maxAttempts: 10,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  const { data: card, error: cardErr } = await supabase
    .from("library_cards")
    .select(
      "id, user_id, date_return, valid_until, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date"
    )
    .eq("id", cardId)
    .eq("user_id", session.userId)
    .single();

  if (cardErr || !card) {
    throw new NotFoundError("Library card not found for your account.");
  }

  const today = getManilaTodayISO();
  if (isCardExpired(card.valid_until, today)) {
    throw new ValidationError("Cannot renew an expired library card.");
  }

  const { data: cardBooks } = await supabase
    .from("library_card_books")
    .select("book_id, copy_id, loan_status")
    .eq("card_id", cardId);

  const holidayDates = await loadLibraryHolidayDateSet(supabase);

  if (cardBooks && cardBooks.length > 0) {
    const hasPendingReplacement = cardBooks.some(
      (cb) => String((cb as Record<string, unknown>).loan_status ?? "") === "replacement_pending"
    );
    if (hasPendingReplacement) {
      throw new ConflictError(
        "Cannot request renewal while a book on this card has a pending replacement."
      );
    }
    const hasActive = cardBooks.some((cb) => {
      const ls = String((cb as Record<string, unknown>).loan_status ?? "borrowed");
      return ls === "borrowed" || ls === "overdue";
    });
    if (!hasActive) {
      throw new ConflictError("Cannot renew a loan that has already been returned or closed.");
    }
  } else {
    const { data: existingReturn } = await supabase
      .from("book_returns")
      .select("id")
      .eq("card_id", cardId)
      .limit(1);
    if (existingReturn && existingReturn.length > 0) {
      throw new ConflictError("Cannot renew a loan that has already been returned.");
    }
  }

  if (computeOverdueDays(card.date_return, today, holidayDates) > 0) {
    throw new ConflictError(
      "Cannot request renewal for an overdue loan. Please return the book at the library."
    );
  }

  if (card.renewal2_checked || (card.renewal1_checked && card.renewal2_checked)) {
    throw new ValidationError("Maximum renewals (2) have already been used for this card.");
  }

  const { storedUnpaid, pendingReplacementCount } = await computeMemberUnpaidFineBalance(
    supabase,
    session.userId,
    today,
    {
      includeLiveOverdue: false,
      holidayDates,
    }
  );
  if (pendingReplacementCount > 0) {
    throw new ConflictError(
      "Cannot request renewal while you have pending book replacement(s) to resolve."
    );
  }
  if (storedUnpaid >= CIRCULATION_RULES.BLOCKING_UNPAID_FINE_PHP) {
    throw new ConflictError(
      `Cannot request renewal while unpaid fines of PHP ${storedUnpaid.toFixed(2)} remain.`
    );
  }

  const reserveCheck = await hasBlockingReservationForCard(supabase, cardBooks ?? []);
  if (reserveCheck.blocked) {
    throw new ConflictError(
      reserveCheck.reason || "Cannot renew because a copy of this book is reserved."
    );
  }

  const { data: existingPending } = await supabase
    .from("account_requests")
    .select("id")
    .eq("user_id", session.userId)
    .eq("card_id", cardId)
    .eq("request_type", "renew")
    .eq("status", "pending")
    .limit(1);

  if (existingPending && existingPending.length > 0) {
    throw new ConflictError("A renewal request for this card is already pending review.");
  }

  const nextRenewal1Checked = true;
  const nextRenewal1Date = card.renewal1_checked ? card.renewal1_date : today;
  const nextRenewal2Checked = Boolean(card.renewal1_checked);
  const nextRenewal2Date = card.renewal1_checked ? today : card.renewal2_date;

  const { data: created, error } = await supabase
    .from("account_requests")
    .insert({
      user_id: session.userId,
      username: session.email,
      request_type: "renew",
      reason: reason || "Patron requested library card renewal.",
      status: "pending",
      card_id: cardId,
      renewal1_checked: nextRenewal1Checked,
      renewal1_date: nextRenewal1Date,
      renewal2_checked: nextRenewal2Checked,
      renewal2_date: nextRenewal2Date,
    })
    .select("id")
    .single();

  if (error || !created) {
    const code = error && typeof error === "object" ? String((error as { code?: unknown }).code ?? "") : "";
    if (code === "23505") {
      throw new ConflictError("A renewal request for this card is already pending review.");
    }
    throw mapDatabaseError(error, "Failed to submit renewal request.");
  }

  return { ok: true, requestId: created.id };
}

export async function getMemberFavorites(
  supabase: SupabaseClient,
  userId: number,
  sessionToken?: string | null
) {
  await verifyMemberActor(supabase, userId, sessionToken);

  const { data, error } = await supabase
    .from("user_favorites")
    .select("id, book_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw mapDatabaseError(error, "Failed to load favorites.");
  const rows = data ?? [];
  return {
    favoriteBookIds: rows.map((r) => Number(r.book_id)),
    favorites: rows,
  };
}

export async function toggleMemberFavorite(
  supabase: SupabaseClient,
  userId: number,
  bookId: number,
  sessionToken?: string | null
) {
  await verifyMemberActor(supabase, userId, sessionToken);

  const { data: existing } = await supabase
    .from("user_favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .limit(1);

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("user_favorites")
      .delete()
      .eq("id", existing[0].id)
      .eq("user_id", userId);
    if (error) throw mapDatabaseError(error, "Failed to remove favorite.");
    return { favorited: false, book_id: bookId };
  }

  const { data: bookRow, error: bookErr } = await supabase
    .from("books")
    .select("id")
    .eq("id", bookId)
    .maybeSingle();

  if (bookErr || !bookRow) {
    throw new NotFoundError("Book not found.");
  }

  const { error } = await supabase
    .from("user_favorites")
    .insert({ user_id: userId, book_id: bookId });
  if (error) throw mapDatabaseError(error, "Failed to add favorite.");
  return { favorited: true, book_id: bookId };
}

export async function getMemberSearchHistory(
  supabase: SupabaseClient,
  userId: number,
  sessionToken?: string | null
) {
  await verifyMemberActor(supabase, userId, sessionToken);

  const { data, error } = await supabase
    .from("user_search_history")
    .select("id, query, searched_at")
    .eq("user_id", userId)
    .order("searched_at", { ascending: false })
    .limit(20);

  if (error) throw mapDatabaseError(error, "Failed to load search history.");
  return { history: data ?? [] };
}

export async function addMemberSearchHistory(
  supabase: SupabaseClient,
  userId: number,
  query: string,
  sessionToken?: string | null
) {
  await verifyMemberActor(supabase, userId, sessionToken);

  const { error } = await supabase
    .from("user_search_history")
    .insert({ user_id: userId, query });
  if (error) throw mapDatabaseError(error, "Failed to record search history.");
  return { ok: true };
}

export async function clearMemberSearchHistory(
  supabase: SupabaseClient,
  userId: number,
  sessionToken?: string | null
) {
  await verifyMemberActor(supabase, userId, sessionToken);

  const { error } = await supabase
    .from("user_search_history")
    .delete()
    .eq("user_id", userId);
  if (error) throw mapDatabaseError(error, "Failed to clear search history.");
  return { ok: true };
}

export async function getMemberNotifications(
  supabase: SupabaseClient,
  userId: number,
  sessionToken?: string | null
) {
  await verifyMemberActor(supabase, userId, sessionToken);

  const [annRes, readsRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, category, pinned, author, target_user_id, created_at")
      .or(`target_user_id.is.null,target_user_id.eq.${userId}`)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("notification_reads")
      .select("announcement_id, read_at, dismissed")
      .eq("user_id", userId),
  ]);

  if (annRes.error) throw mapDatabaseError(annRes.error, "Failed to load notifications.");
  const readMap = new Map<number, { read_at: string; dismissed: boolean }>();
  for (const r of readsRes.data ?? []) {
    readMap.set(Number(r.announcement_id), {
      read_at: String(r.read_at ?? ""),
      dismissed: Boolean(r.dismissed),
    });
  }

  const notifications = (annRes.data ?? [])
    .map((a) => {
      const state = readMap.get(Number(a.id));
      return {
        ...a,
        author: safeDecryptPii(a.author) || "Library Staff",
        is_read: Boolean(state),
        dismissed: Boolean(state?.dismissed),
        read_at: state?.read_at ?? null,
      };
    })
    .filter((n) => !n.dismissed);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  return { notifications, unreadCount };
}

export async function updateMemberNotificationState(
  supabase: SupabaseClient,
  userId: number,
  action: "read" | "dismiss" | "read_all",
  announcementId?: number,
  sessionToken?: string | null
) {
  await verifyMemberActor(supabase, userId, sessionToken);

  const nowIso = new Date().toISOString();

  if (action === "read_all") {
    const { notifications } = await getMemberNotifications(supabase, userId, sessionToken);
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => Number(n.id));
    if (unreadIds.length > 0) {
      const upsertRows = unreadIds.map((id) => ({
        user_id: userId,
        announcement_id: id,
        read_at: nowIso,
        dismissed: false,
      }));
      const { error } = await supabase
        .from("notification_reads")
        .upsert(upsertRows, { onConflict: "user_id,announcement_id" });
      if (error) throw mapDatabaseError(error, "Failed to mark notifications as read.");
    }
    return { ok: true, markedCount: unreadIds.length };
  }

  if (!announcementId) {
    throw new ValidationError("Announcement ID is required.");
  }

  // Enforce recipient privacy: a member may only mark/dismiss broadcast announcements
  // or announcements explicitly addressed to them.
  const { data: annRow, error: annErr } = await supabase
    .from("announcements")
    .select("id, target_user_id")
    .eq("id", announcementId)
    .single();

  if (
    annErr ||
    !annRow ||
    (annRow.target_user_id !== null && Number(annRow.target_user_id) !== userId)
  ) {
    throw new NotFoundError("Announcement not found.");
  }

  const { error } = await supabase.from("notification_reads").upsert(
    {
      user_id: userId,
      announcement_id: announcementId,
      read_at: nowIso,
      dismissed: action === "dismiss",
    },
    { onConflict: "user_id,announcement_id" }
  );

  if (error) throw mapDatabaseError(error, "Failed to update notification state.");
  return { ok: true };
}

export async function getMemberSettings(
  supabase: SupabaseClient,
  userId: number,
  sessionToken?: string | null
) {
  await verifyMemberActor(supabase, userId, sessionToken);

  const [userRes, sessionsRes, favCountRes, searchCountRes, reqRes] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, username, email_display, firstname, lastname, gender, phone_number, city, province, school, occupation, role, is_active, is_approved, otp_enabled, pin_enabled, pin_code, pin_set_at, valid_id_path, created_at, last_seen"
      )
      .eq("id", userId)
      .single(),
    supabase
      .from("login_sessions")
      .select("id, login_at, last_active_at, logout_at")
      .eq("user_id", userId)
      .order("login_at", { ascending: false })
      .limit(12),
    supabase
      .from("user_favorites")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("user_search_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("account_requests")
      .select("id, request_type, status, reason, admin_note, created_at")
      .eq("user_id", userId)
      .in("request_type", ["deactivate", "delete"])
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (userRes.error || !userRes.data) {
    throw new NotFoundError("Account not found.");
  }

  const u = userRes.data;
  const hasPin = Boolean(u.pin_code);
  const pinSetMs = u.pin_set_at ? Date.parse(String(u.pin_set_at)) : NaN;
  const pinExpired = Boolean(
    hasPin && (!Number.isFinite(pinSetMs) || Date.now() - pinSetMs > PIN_EXPIRY_MS)
  );
  const pinValid = Boolean(hasPin && !pinExpired);
  const pinDaysLeft = pinValid
    ? Math.max(1, Math.ceil((PIN_EXPIRY_MS - (Date.now() - pinSetMs)) / (24 * 60 * 60 * 1000)))
    : 0;

  return {
    profile: {
      id: u.id,
      email: resolveEmail(u.email_display, u.username),
      firstname: safeDecryptPii(u.firstname),
      lastname: safeDecryptPii(u.lastname),
      fullname: formatFullName(u.firstname, u.lastname),
      gender: safeDecryptPii(u.gender),
      phone_number: safeDecryptPii(u.phone_number),
      city: safeDecryptPii(u.city),
      province: safeDecryptPii(u.province),
      school: safeDecryptPii(u.school),
      occupation: safeDecryptPii(u.occupation),
      role: u.role,
      is_active: u.is_active,
      is_approved: u.is_approved,
      otp_enabled: Boolean(u.otp_enabled),
      pin_enabled: Boolean(u.pin_enabled) && !pinExpired,
      has_pin: hasPin,
      pin_expired: pinExpired,
      pin_valid: pinValid,
      pin_days_left: pinDaysLeft,
      has_valid_id: Boolean(u.valid_id_path),
      created_at: u.created_at,
      last_seen: u.last_seen,
    },
    counts: {
      favorites: favCountRes.count ?? 0,
      searchHistory: searchCountRes.count ?? 0,
    },
    latestAccountRequest: reqRes.data?.[0] ?? null,
    loginActivity: (sessionsRes.data ?? []).map((s) => ({
      id: s.id,
      login_at: s.login_at,
      last_active_at: s.last_active_at,
      logout_at: s.logout_at,
    })),
  };
}

export async function mutateMemberSettings(
  supabase: SupabaseClient,
  session: SessionPayload,
  input: UserSettingsMutationInput,
  clientIp = "127.0.0.1"
) {
  await verifyMemberActor(supabase, session.userId, session.sessionToken);

  if (input.action === "update_profile") {
    const { error } = await supabase
      .from("users")
      .update({
        firstname: input.firstname,
        lastname: input.lastname,
        gender: input.gender || null,
        phone_number: input.phone_number || null,
        city: input.city || null,
        province: input.province || null,
        school: input.school || null,
        occupation: input.occupation || null,
      })
      .eq("id", session.userId);

    if (error) throw mapDatabaseError(error, "Failed to update profile.");
  } else if (input.action === "change_password") {
    await enforceRateLimit(
      {
        scope: "user:change_password",
        identifier: `${clientIp}:${session.userId}`,
        maxAttempts: 8,
        windowSeconds: 300,
        blockSeconds: 300,
      },
      supabase
    );

    const { data: user } = await supabase
      .from("users")
      .select("password")
      .eq("id", session.userId)
      .single();

    if (!user || !(await bcrypt.compare(input.current_password, String(user.password)))) {
      throw new ForbiddenError("Current password is incorrect.");
    }

    if (await bcrypt.compare(input.new_password, String(user.password))) {
      throw new ValidationError("New password must be different from the current one.");
    }

    const hashed = await bcrypt.hash(input.new_password, 12);
    const { error } = await supabase
      .from("users")
      .update({
        password: hashed,
        failed_attempts: 0,
        is_locked: false,
        lock_until: null,
        reset_token: null,
        reset_token_expiry: null,
      })
      .eq("id", session.userId);
    if (error) throw mapDatabaseError(error, "Failed to update password.");
  } else if (input.action === "set_pin") {
    await enforceRateLimit(
      {
        scope: "user:set_pin",
        identifier: `${clientIp}:${session.userId}`,
        maxAttempts: 8,
        windowSeconds: 300,
        blockSeconds: 300,
      },
      supabase
    );

    const { data: user } = await supabase
      .from("users")
      .select("password")
      .eq("id", session.userId)
      .single();

    if (!user || !(await bcrypt.compare(input.password, String(user.password)))) {
      throw new ForbiddenError("Current password is incorrect.");
    }

    const hashedPin = await bcrypt.hash(input.pin, 12);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({
        pin_code: hashedPin,
        pin_enabled: true,
        pin_set_at: nowIso,
        pin_reset_token: null,
        pin_reset_token_expiry: null,
      })
      .eq("id", session.userId);

    if (error) throw mapDatabaseError(error, "Failed to update security PIN.");

    await recordAuditEvent(
      {
        action: "set_pin",
        resource: "user_settings",
        actorId: session.userId,
        targetId: session.userId,
        actorRole: session.role,
        route: "/api/user/settings",
        method: "PUT",
      },
      supabase
    );

    return { ok: true, has_pin: true, pin_enabled: true };
  } else if (input.action === "toggle_security") {
    if (input.method === "pin" && input.enabled) {
      const { data: uRow } = await supabase
        .from("users")
        .select("pin_code, pin_set_at")
        .eq("id", session.userId)
        .maybeSingle();
      if (!uRow?.pin_code) {
        throw new ValidationError(
          "Please set a 6-digit security PIN before enabling PIN verification."
        );
      }
      const pinSetMs = uRow.pin_set_at ? Date.parse(String(uRow.pin_set_at)) : NaN;
      if (!Number.isFinite(pinSetMs) || Date.now() - pinSetMs > PIN_EXPIRY_MS) {
        throw new ValidationError(
          "Your security PIN has expired (older than 7 days). Please set a new 6-digit PIN first."
        );
      }
    }
    const col = input.method === "otp" ? "otp_enabled" : "pin_enabled";
    const { error } = await supabase
      .from("users")
      .update({ [col]: input.enabled })
      .eq("id", session.userId);
    if (error) throw mapDatabaseError(error, "Failed to update security preference.");
  } else if (input.action === "submit_account_request") {
    const { data: existingPending } = await supabase
      .from("account_requests")
      .select("id")
      .eq("user_id", session.userId)
      .eq("status", "pending")
      .in("request_type", ["deactivate", "delete"])
      .limit(1);

    if (existingPending && existingPending.length > 0) {
      throw new ConflictError("You already have a pending account request under review.");
    }

    const { error } = await supabase.from("account_requests").insert({
      user_id: session.userId,
      username: session.email,
      request_type: input.request_type,
      reason: input.reason,
      status: "pending",
    });
    if (error) throw mapDatabaseError(error, "Failed to submit account request.");
  } else if (input.action === "clear_search_history") {
    const { error } = await supabase
      .from("user_search_history")
      .delete()
      .eq("user_id", session.userId);
    if (error) throw mapDatabaseError(error, "Failed to clear search history.");
  } else if (input.action === "clear_favorites") {
    const { error } = await supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", session.userId);
    if (error) throw mapDatabaseError(error, "Failed to clear favorites.");
  }

  await recordAuditEvent(
    {
      action: input.action,
      resource: "user_settings",
      actorId: session.userId,
      targetId: session.userId,
      actorRole: session.role,
      route: "/api/user/settings",
      method: "PUT",
    },
    supabase
  );

  return { ok: true };
}

export async function getMemberValidIdPath(
  supabase: SupabaseClient,
  session: SessionPayload,
  clientIp = "127.0.0.1"
): Promise<{ dropboxPath: string }> {
  await verifyMemberActor(supabase, session.userId, session.sessionToken);

  await enforceRateLimit(
    {
      scope: "user:valid-id",
      identifier: `${clientIp}:${session.userId}`,
      maxAttempts: 20,
      windowSeconds: 300,
      blockSeconds: 300,
    },
    supabase
  );

  const { data: user, error } = await supabase
    .from("users")
    .select("valid_id_path")
    .eq("id", session.userId)
    .single();

  if (error || !user || !user.valid_id_path) {
    throw new NotFoundError("Valid ID not found for your account.");
  }

  const decryptedPath = safeDecryptPii(user.valid_id_path).trim();
  if (!decryptedPath) {
    throw new NotFoundError("Valid ID path is unavailable.");
  }

  const dropboxPath = decryptedPath.startsWith("/")
    ? decryptedPath
    : `${DROPBOX_FOLDERS["valid-ids"]().replace(/\/+$/, "")}/${decryptedPath.replace(/^.*[\\/]/, "")}`;

  await recordAuditEvent(
    {
      action: "view_own_valid_id",
      resource: "valid_id",
      actorId: session.userId,
      targetId: session.userId,
      actorRole: session.role,
      route: "/api/user/valid-id",
      method: "GET",
    },
    supabase
  );

  return { dropboxPath };
}
