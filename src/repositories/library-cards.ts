import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { safeDecryptData, safeDecryptPii } from "@/lib/crypto/fernet";
import { AdminMutationError, formatFullName } from "@/repositories/shared";

export async function queryLibraryCards(supabase: SupabaseClient) {
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

export async function mutateLibraryCards(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  if (action === "delete") {
    if (!id) throw new AdminMutationError("Card ID is required.");
    const { error } = await supabase.from("library_cards").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, deletedId: id };
  }

  if (action === "create") {
    const firstname = String(payload.firstname ?? "").trim();
    const lastname = String(payload.lastname ?? "").trim();
    if (!firstname || !lastname) {
      throw new AdminMutationError("First name and last name are required.");
    }
    const category = payload.card_type_category === "member" ? "member" : "borrower";
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateIssued = String(payload.date_issued ?? "").trim() || todayStr;
    const dateReturn = String(payload.date_return ?? "").trim() || null;
    const bookId = payload.book_id ? Number(payload.book_id) : null;
    const quantity = Math.max(1, Number(payload.quantity ?? 1) || 1);

    const { data: card, error } = await supabase
      .from("library_cards")
      .insert({
        card_type_category: category,
        user_id: payload.user_id ? Number(payload.user_id) : null,
        firstname,
        lastname,
        phone_number: payload.phone_number ? String(payload.phone_number).trim() : null,
        address: payload.address ? String(payload.address).trim() : null,
        date_issued: dateIssued,
        date_return: dateReturn,
        card_type: String(payload.card_type ?? "regular").trim() || "regular",
        valid_until: String(payload.valid_until ?? "").trim() || null,
        registered_by: session.userId,
      })
      .select("id")
      .single();

    if (error || !card) throw new AdminMutationError(error?.message || "Failed to issue card.", 500);

    if (bookId) {
      const { data: book } = await supabase
        .from("books")
        .select("id, title, author, isbn")
        .eq("id", bookId)
        .single();
      if (book) {
        await supabase.from("library_card_books").insert({
          card_id: card.id,
          book_id: book.id,
          book_title: safeDecryptData(book.title),
          book_author: safeDecryptData(book.author),
          book_isbn: safeDecryptData(book.isbn),
          quantity,
        });
        const { data: inv } = await supabase
          .from("book_inventory")
          .select("id, available_copies")
          .eq("book_id", book.id)
          .single();
        if (inv) {
          await supabase
            .from("book_inventory")
            .update({ available_copies: Math.max(0, inv.available_copies - quantity) })
            .eq("id", inv.id);
        }
      }
    }

    return { ok: true, id: card.id };
  }

  if (action === "return_books") {
    if (!id) throw new AdminMutationError("Card ID is required.");
    const returnDate =
      String(payload.return_date ?? "").trim() || new Date().toISOString().slice(0, 10);

    const { data: cardBooks } = await supabase
      .from("library_card_books")
      .select("*")
      .eq("card_id", id);

    if (!cardBooks || cardBooks.length === 0) {
      throw new AdminMutationError("No borrowed books recorded on this card.");
    }

    const { data: retRow, error } = await supabase
      .from("book_returns")
      .insert({
        card_id: id,
        return_date: returnDate,
        processed_by: session.userId,
      })
      .select("id")
      .single();

    if (error || !retRow) throw new AdminMutationError(error?.message || "Failed to log return.", 500);

    for (const cb of cardBooks) {
      await supabase.from("book_return_items").insert({
        return_id: retRow.id,
        card_book_id: cb.id,
        book_title: cb.book_title,
        book_author: cb.book_author,
        book_isbn: cb.book_isbn,
        qty_returned: cb.quantity ?? 1,
      });

      if (cb.book_id) {
        const { data: inv } = await supabase
          .from("book_inventory")
          .select("id, volumes, available_copies")
          .eq("book_id", cb.book_id)
          .single();
        if (inv) {
          await supabase
            .from("book_inventory")
            .update({
              available_copies: Math.min(
                inv.volumes,
                inv.available_copies + (cb.quantity ?? 1)
              ),
            })
            .eq("id", inv.id);
        }
      }
    }
    return { ok: true, returnId: retRow.id };
  }

  if (action === "renew" || action === "update") {
    if (!id) throw new AdminMutationError("Card ID is required.");
    const { error } = await supabase
      .from("library_cards")
      .update({
        date_return: String(payload.date_return ?? "").trim() || null,
        valid_until: String(payload.valid_until ?? "").trim() || null,
        renewal1_checked: Boolean(payload.renewal1_checked),
        renewal1_date: String(payload.renewal1_date ?? "").trim() || null,
        renewal2_checked: Boolean(payload.renewal2_checked),
        renewal2_date: String(payload.renewal2_date ?? "").trim() || null,
      })
      .eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, id };
  }

  throw new AdminMutationError(`Unknown library_cards action: ${action}`);
}
