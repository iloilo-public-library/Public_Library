import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { AdminMutationError, formatFullName } from "@/repositories/shared";
import { mutateLibraryCards } from "@/repositories/library-cards";

export async function queryReturns(supabase: SupabaseClient) {
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

export async function mutateReturns(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  if (action === "delete") {
    if (!id) throw new AdminMutationError("Return item ID is required.");
    const { error } = await supabase.from("book_return_items").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, deletedId: id };
  }

  if (action === "create") {
    const cardId = Number(payload.card_id);
    if (!cardId) throw new AdminMutationError("A valid Library Card ID is required.");
    return mutateLibraryCards(supabase, session, "return_books", cardId, payload);
  }

  throw new AdminMutationError(`Unknown returns action: ${action}`);
}
