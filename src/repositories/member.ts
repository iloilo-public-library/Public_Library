import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { safeDecryptData, safeDecryptPii } from "@/lib/crypto/fernet";
import { AdminMutationError, formatFullName } from "@/repositories/shared";

export async function getMemberBorrowedBooks(supabase: SupabaseClient, userId: number) {
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

  if (cardsRes.error) throw cardsRes.error;
  const cards = cardsRes.data ?? [];
  if (cards.length === 0) {
    return { cards: [], borrowedBooks: [] };
  }

  const cardIds = cards.map((c) => c.id as number);
  const [booksRes, returnsRes] = await Promise.all([
    supabase
      .from("library_card_books")
      .select("id, card_id, book_id, book_title, book_author, book_isbn, quantity, added_at")
      .in("card_id", cardIds)
      .order("id", { ascending: false }),
    supabase
      .from("book_returns")
      .select("id, card_id")
      .in("card_id", cardIds),
  ]);

  if (booksRes.error) throw booksRes.error;

  const returnedCardIds = new Set<number>((returnsRes.data ?? []).map((r) => Number(r.card_id)));
  const pendingRenewCardIds = new Set<number>(
    (pendingRenewRes.data ?? []).map((r) => Number(r.card_id)).filter(Boolean)
  );

  const booksByCard = new Map<number, Record<string, unknown>[]>();
  for (const b of booksRes.data ?? []) {
    const cid = Number(b.card_id);
    const list = booksByCard.get(cid) ?? [];
    list.push({
      id: b.id,
      card_id: cid,
      book_id: b.book_id,
      book_title: safeDecryptData(b.book_title),
      book_author: safeDecryptData(b.book_author),
      book_isbn: safeDecryptData(b.book_isbn),
      quantity: Number(b.quantity ?? 1),
      added_at: b.added_at,
    });
    booksByCard.set(cid, list);
  }

  const formattedCards = cards.map((c) => {
    const cid = Number(c.id);
    const cardBooks = booksByCard.get(cid) ?? [];
    const isReturned = returnedCardIds.has(cid);
    const hasPendingRenewal = pendingRenewCardIds.has(cid);
    const canRenew = !isReturned && !hasPendingRenewal && (!c.renewal1_checked || !c.renewal2_checked);

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
      has_pending_renewal: hasPendingRenewal,
      can_renew: canRenew,
      books: cardBooks,
    };
  });

  const activeBorrowedBooks = formattedCards
    .filter((c) => !c.is_returned)
    .flatMap((c) =>
      c.books.map((b) => ({
        ...b,
        date_issued: c.date_issued,
        date_return: c.date_return,
        card_type_category: c.card_type_category,
        can_renew: c.can_renew,
        has_pending_renewal: c.has_pending_renewal,
      }))
    );

  return { cards: formattedCards, borrowedBooks: activeBorrowedBooks };
}

export async function getMemberReturnHistory(supabase: SupabaseClient, userId: number) {
  const { data: cards, error: cardsErr } = await supabase
    .from("library_cards")
    .select("id, card_type_category, date_issued")
    .eq("user_id", userId);

  if (cardsErr) throw cardsErr;
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
    .select("id, card_id, return_date, created_at")
    .in("card_id", cardIds)
    .order("return_date", { ascending: false });

  if (retErr) throw retErr;
  if (!returnsData || returnsData.length === 0) return { returns: [] };

  const returnIds = returnsData.map((r) => Number(r.id));
  const { data: itemsData, error: itemsErr } = await supabase
    .from("book_return_items")
    .select("id, return_id, card_book_id, book_title, book_author, book_isbn, qty_returned")
    .in("return_id", returnIds)
    .order("id", { ascending: false });

  if (itemsErr) throw itemsErr;

  const retMap = new Map<number, { card_id: number; return_date: string; created_at: string }>();
  for (const r of returnsData) {
    retMap.set(Number(r.id), {
      card_id: Number(r.card_id),
      return_date: String(r.return_date ?? ""),
      created_at: String(r.created_at ?? ""),
    });
  }

  const returns = (itemsData ?? []).map((item) => {
    const ret = retMap.get(Number(item.return_id));
    const card = ret ? cardMap.get(ret.card_id) : undefined;
    return {
      id: item.id,
      return_id: item.return_id,
      card_id: ret?.card_id ?? null,
      card_type_category: card?.card_type_category ?? "member",
      date_issued: card?.date_issued ?? "",
      return_date: ret?.return_date ?? "",
      book_title: safeDecryptData(item.book_title),
      book_author: safeDecryptData(item.book_author),
      book_isbn: safeDecryptData(item.book_isbn),
      qty_returned: Number(item.qty_returned ?? 1),
    };
  });

  return { returns };
}

export async function requestMemberCardRenewal(
  supabase: SupabaseClient,
  session: SessionPayload,
  cardId: number,
  reason: string
) {
  const { data: card, error: cardErr } = await supabase
    .from("library_cards")
    .select("id, user_id, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date")
    .eq("id", cardId)
    .eq("user_id", session.userId)
    .single();

  if (cardErr || !card) {
    throw new AdminMutationError("Library card not found for your account.", 404);
  }

  if (card.renewal1_checked && card.renewal2_checked) {
    throw new AdminMutationError("Maximum renewals (2) have already been used for this card.", 400);
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
    throw new AdminMutationError("A renewal request for this card is already pending review.", 409);
  }

  const today = new Date().toISOString().slice(0, 10);
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
    throw new AdminMutationError(error?.message || "Failed to submit renewal request.", 500);
  }

  return { ok: true, requestId: created.id };
}

export async function getMemberFavorites(supabase: SupabaseClient, userId: number) {
  const { data, error } = await supabase
    .from("user_favorites")
    .select("id, book_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = data ?? [];
  return {
    favoriteBookIds: rows.map((r) => Number(r.book_id)),
    favorites: rows,
  };
}

export async function toggleMemberFavorite(
  supabase: SupabaseClient,
  userId: number,
  bookId: number
) {
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
      .eq("id", existing[0].id);
    if (error) throw error;
    return { favorited: false, book_id: bookId };
  }

  const { error } = await supabase
    .from("user_favorites")
    .insert({ user_id: userId, book_id: bookId });
  if (error) throw error;
  return { favorited: true, book_id: bookId };
}

export async function getMemberSearchHistory(supabase: SupabaseClient, userId: number) {
  const { data, error } = await supabase
    .from("user_search_history")
    .select("id, query, searched_at")
    .eq("user_id", userId)
    .order("searched_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return { history: data ?? [] };
}

export async function addMemberSearchHistory(
  supabase: SupabaseClient,
  userId: number,
  query: string
) {
  const { error } = await supabase
    .from("user_search_history")
    .insert({ user_id: userId, query });
  if (error) throw error;
  return { ok: true };
}

export async function clearMemberSearchHistory(supabase: SupabaseClient, userId: number) {
  const { error } = await supabase
    .from("user_search_history")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
  return { ok: true };
}

export async function getMemberNotifications(supabase: SupabaseClient, userId: number) {
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

  if (annRes.error) throw annRes.error;
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
  announcementId?: number
) {
  const nowIso = new Date().toISOString();

  if (action === "read_all") {
    const { notifications } = await getMemberNotifications(supabase, userId);
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
      if (error) throw error;
    }
    return { ok: true, markedCount: unreadIds.length };
  }

  if (!announcementId) {
    throw new AdminMutationError("Announcement ID is required.", 400);
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

  if (error) throw error;
  return { ok: true };
}
