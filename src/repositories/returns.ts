import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { STAFF_ROLES } from "@/config/constants";
import { safeDecryptPii } from "@/lib/crypto/fernet";
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
      .select("id, firstname, lastname, phone_number, date_issued, card_type_category"),
  ]);
  if (itemsRes.error) throw itemsRes.error;

  const staffIds = Array.from(
    new Set(
      (returnsRes.data ?? [])
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
    const processedById = ret?.processed_by ? Number(ret.processed_by) : 0;
    return {
      ...item,
      card_id: ret?.card_id ?? null,
      return_date: ret?.return_date ?? "",
      date_issued: card?.date_issued ?? "",
      phone_number: card ? safeDecryptPii(card.phone_number) : "",
      borrower_name: card
        ? formatFullName(card.firstname, card.lastname)
        : "—",
      card_category: card?.card_type_category ?? "—",
      processed_by_name: processedById ? (staffMap.get(processedById) ?? "—") : "—",
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
  await verifyRepositoryActor(supabase, session.userId, STAFF_ROLES);

  if (action === "delete") {
    if (!id) throw new AdminMutationError("Return item ID is required.", 400);
    const { error } = await supabase.from("book_return_items").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      deletedId: id,
      audit_details: `action=delete_return_item id=${id}`,
    };
  }

  if (action === "create") {
    const cardId = Number(payload.card_id);
    if (!cardId) throw new AdminMutationError("A valid Library Card ID is required.", 400);
    return mutateLibraryCards(supabase, session, "return_books", cardId, payload);
  }

  throw new AdminMutationError(`Unknown returns action: ${action}`, 400);
}
