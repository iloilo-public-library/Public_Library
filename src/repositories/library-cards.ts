import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { STAFF_ROLES } from "@/config/constants";
import { safeDecryptData, safeDecryptPii } from "@/lib/crypto/fernet";
import { deleteFromDropbox, isDropboxConfigured } from "@/lib/storage/dropbox";
import { DROPBOX_FOLDERS } from "@/lib/storage";
import { AdminMutationError, formatFullName } from "@/repositories/shared";
import {
  libraryCardCreateSchema,
  libraryCardReturnSchema,
  libraryCardUpdateSchema,
} from "@/validators/admin";

interface BookSnapshot {
  book_id: number;
  title: string;
  author: string;
  isbn: string;
  qty: number;
}

/**
 * Matches `resolve_book_snapshots` in `legacy-flask/helpers/helpers.py`.
 * Supports either single `(book_id, quantity)` or `book_ids` array (`[1, { id: 2, qty: 3 }]`).
 */
async function resolveBookSnapshots(
  supabase: SupabaseClient,
  singleBookId: number | null,
  singleQty: number,
  rawBookIds?: unknown[]
): Promise<BookSnapshot[]> {
  const requested: Array<{ id: number; qty: number }> = [];

  if (Array.isArray(rawBookIds) && rawBookIds.length > 0) {
    for (const item of rawBookIds) {
      if (typeof item === "number" || typeof item === "string") {
        const bid = Number(item);
        if (Number.isInteger(bid) && bid > 0) {
          requested.push({ id: bid, qty: 1 });
        }
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const bid = Number(obj.id ?? obj.book_id ?? 0);
        const qty = Math.max(1, Number(obj.qty ?? obj.quantity ?? 1) || 1);
        if (Number.isInteger(bid) && bid > 0) {
          requested.push({ id: bid, qty });
        }
      }
    }
  } else if (singleBookId && singleBookId > 0) {
    requested.push({ id: singleBookId, qty: Math.max(1, singleQty || 1) });
  }

  if (requested.length === 0) return [];

  const uniqueIds = Array.from(new Set(requested.map((r) => r.id)));
  const { data: books } = await supabase
    .from("books")
    .select("id, title, author, isbn")
    .in("id", uniqueIds);

  const bookMap = new Map<number, { id: number; title: unknown; author: unknown; isbn: unknown }>();
  for (const b of books ?? []) {
    bookMap.set(Number(b.id), b);
  }

  const snapshots: BookSnapshot[] = [];
  for (const req of requested) {
    const b = bookMap.get(req.id);
    if (!b) continue;
    snapshots.push({
      book_id: Number(b.id),
      title: safeDecryptData(b.title),
      author: safeDecryptData(b.author),
      isbn: safeDecryptData(b.isbn),
      qty: req.qty,
    });
  }
  return snapshots;
}

/**
 * Matches `insert_card_books` + `update_inventory_on_borrow` in `legacy-flask/helpers/helpers.py`.
 */
async function insertCardBooksAndDeductInventory(
  supabase: SupabaseClient,
  cardId: number,
  snapshots: BookSnapshot[]
): Promise<void> {
  if (snapshots.length === 0) return;

  await supabase.from("library_card_books").insert(
    snapshots.map((s) => ({
      card_id: cardId,
      book_id: s.book_id,
      book_title: s.title,
      book_author: s.author,
      book_isbn: s.isbn,
      quantity: s.qty,
    }))
  );

  for (const s of snapshots) {
    const { data: inv } = await supabase
      .from("book_inventory")
      .select("id, available_copies")
      .eq("book_id", s.book_id)
      .maybeSingle();

    if (inv) {
      await supabase
        .from("book_inventory")
        .update({
          available_copies: Math.max(0, Number(inv.available_copies ?? 0) - s.qty),
        })
        .eq("id", inv.id);
    } else {
      await supabase.from("book_inventory").insert({
        book_id: s.book_id,
        volumes: 1,
        available_copies: 0,
        damaged_copies: 0,
        lost_copies: 0,
        status: "Available",
      });
    }
  }
}

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
  const rows = (cardsRes.data ?? []).map((c) => {
    const cardBooks = booksByCard.get(c.id as number) ?? [];
    const fn = safeDecryptPii(c.firstname);
    const ln = safeDecryptPii(c.lastname);
    const rawPhoto = c.photo_path ? String(c.photo_path).replace(/\\/g, "/") : "";
    const photoUrl = rawPhoto
      ? rawPhoto.startsWith("/") || rawPhoto.startsWith("http")
        ? rawPhoto
        : `/${rawPhoto}`
      : "";
    return {
      ...c,
      type: c.card_type_category,
      firstname: fn,
      lastname: ln,
      fullname: formatFullName(c.firstname, c.lastname),
      phone_number: safeDecryptPii(c.phone_number),
      address: safeDecryptPii(c.address),
      photo_url: photoUrl,
      registered_by_name:
        typeof c.registered_by === "number"
          ? (staffMap.get(c.registered_by) ?? "—")
          : "—",
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
  await verifyRepositoryActor(supabase, session.userId, STAFF_ROLES);

  if (action === "delete") {
    if (!id) throw new AdminMutationError("Card ID is required.", 400);
    const { data: existing } = await supabase
      .from("library_cards")
      .select("id, photo_path")
      .eq("id", id)
      .maybeSingle();
    if (!existing) {
      throw new AdminMutationError("Card not found.", 404);
    }

    const { error } = await supabase.from("library_cards").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);

    // Clean up card photo in Dropbox if configured (matches api_delete_library_card in admin_routes.py)
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
      audit_details: `action=delete_library_card id=${id}`,
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

    const firstname = parsed.data.firstname;
    const lastname = parsed.data.lastname;
    const category = parsed.data.card_type_category === "member" ? "member" : "borrower";
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateIssued = String(parsed.data.date_issued || "").trim() || todayStr;
    const dateReturn = String(parsed.data.date_return || "").trim() || null;
    const phone = String(parsed.data.phone_number || parsed.data.phone || "").trim() || null;
    const address = String(parsed.data.address || "").trim() || null;
    const photoPath = String(parsed.data.photo_path || "").trim() || null;

    const ren1Checked =
      payload.renewal1_checked === true ||
      payload.renewal1_checked === "1" ||
      payload.renewal1_checked === 1;
    const ren1Date = String(parsed.data.renewal1_date || "").trim() || null;
    const ren2Checked =
      payload.renewal2_checked === true ||
      payload.renewal2_checked === "1" ||
      payload.renewal2_checked === 1;
    const ren2Date = String(parsed.data.renewal2_date || "").trim() || null;

    const bookId = parsed.data.book_id ? Number(parsed.data.book_id) : null;
    const quantity = Math.max(1, Number(parsed.data.quantity ?? 1) || 1);
    const snapshots = await resolveBookSnapshots(
      supabase,
      bookId,
      quantity,
      parsed.data.book_ids
    );

    const { data: card, error } = await supabase
      .from("library_cards")
      .insert({
        card_type_category: category,
        user_id:
          category === "member" && parsed.data.user_id
            ? Number(parsed.data.user_id)
            : null,
        firstname,
        lastname,
        phone_number: phone,
        address,
        date_issued: dateIssued,
        date_return: dateReturn,
        renewal1_checked: ren1Checked,
        renewal1_date: ren1Date,
        renewal2_checked: ren2Checked,
        renewal2_date: ren2Date,
        card_type: String(parsed.data.card_type || "regular").trim() || "regular",
        valid_until: String(parsed.data.valid_until || "").trim() || null,
        photo_path: photoPath,
        registered_by: session.userId,
      })
      .select("id")
      .single();

    if (error || !card) {
      throw new AdminMutationError(error?.message || "Failed to issue card.", 500);
    }

    const newCardId = Number(card.id);
    await insertCardBooksAndDeductInventory(supabase, newCardId, snapshots);

    return {
      ok: true,
      id: newCardId,
      audit_details: `action=create_library_card id=${newCardId} category=${category} books=${snapshots.length}`,
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

    const returnDate =
      String(parsed.data.return_date || "").trim() ||
      new Date().toISOString().slice(0, 10);

    const { data: existingCard } = await supabase
      .from("library_cards")
      .select("id")
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

    // Determine per-book return items (matches api_return_library_card in admin_routes.py lines 1950-1975)
    const itemsToReturn: Array<{
      cb: Record<string, unknown>;
      qtyReturned: number;
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
          itemsToReturn.push({ cb: matchedCb, qtyReturned });
        }
      }
    } else {
      for (const cb of cardBooks) {
        itemsToReturn.push({
          cb,
          qtyReturned: Math.max(1, Number(cb.quantity ?? 1) || 1),
        });
      }
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

    if (error || !retRow) {
      throw new AdminMutationError(error?.message || "Failed to log return.", 500);
    }

    for (const { cb, qtyReturned } of itemsToReturn) {
      await supabase.from("book_return_items").insert({
        return_id: retRow.id,
        card_book_id: cb.id,
        book_title: cb.book_title,
        book_author: cb.book_author,
        book_isbn: cb.book_isbn,
        qty_returned: qtyReturned,
      });

      // Mark library_card_books loan_status as returned if column exists
      try {
        await supabase
          .from("library_card_books")
          .update({ loan_status: "returned" })
          .eq("id", cb.id);
      } catch {
        // Ignore if loan_status column not yet migrated
      }

      if (cb.book_id) {
        const { data: inv } = await supabase
          .from("book_inventory")
          .select("id, volumes, available_copies")
          .eq("book_id", cb.book_id)
          .maybeSingle();
        if (inv) {
          await supabase
            .from("book_inventory")
            .update({
              available_copies: Math.min(
                Number(inv.volumes ?? qtyReturned),
                Number(inv.available_copies ?? 0) + qtyReturned
              ),
            })
            .eq("id", inv.id);
        } else {
          await supabase.from("book_inventory").insert({
            book_id: cb.book_id,
            volumes: qtyReturned,
            available_copies: qtyReturned,
            damaged_copies: 0,
            lost_copies: 0,
            status: "Available",
          });
        }
      }
    }
    return {
      ok: true,
      returnId: retRow.id,
      return_id: retRow.id,
      audit_details: `action=return_books card_id=${id} return_id=${retRow.id} items=${itemsToReturn.length}`,
    };
  }

  if (action === "renew" || action === "update") {
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

    const updateFields: Record<string, unknown> = {
      date_return: String(parsed.data.date_return || "").trim() || null,
      valid_until: String(parsed.data.valid_until || "").trim() || null,
      renewal1_checked: Boolean(
        payload.renewal1_checked === true ||
          payload.renewal1_checked === "1" ||
          payload.renewal1_checked === 1
      ),
      renewal1_date: String(parsed.data.renewal1_date || "").trim() || null,
      renewal2_checked: Boolean(
        payload.renewal2_checked === true ||
          payload.renewal2_checked === "1" ||
          payload.renewal2_checked === 1
      ),
      renewal2_date: String(parsed.data.renewal2_date || "").trim() || null,
    };

    if (parsed.data.firstname) {
      updateFields.firstname = parsed.data.firstname;
    }
    if (parsed.data.lastname) {
      updateFields.lastname = parsed.data.lastname;
    }
    if (payload.phone_number !== undefined || payload.phone !== undefined) {
      updateFields.phone_number =
        String(parsed.data.phone_number || parsed.data.phone || "").trim() || null;
    }
    if (payload.address !== undefined) {
      updateFields.address = String(parsed.data.address || "").trim() || null;
    }
    if (parsed.data.card_type) {
      updateFields.card_type = parsed.data.card_type;
    }

    const { error } = await supabase
      .from("library_cards")
      .update(updateFields)
      .eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);

    // If book_ids array was supplied on update, restore old inventory & replace borrowed books (matches api_update_library_card in admin_routes.py lines 1885-1912)
    if (Array.isArray(parsed.data.book_ids)) {
      const { data: oldBooks } = await supabase
        .from("library_card_books")
        .select("book_id, quantity")
        .eq("card_id", id);

      for (const ob of oldBooks ?? []) {
        if (!ob.book_id) continue;
        const { data: inv } = await supabase
          .from("book_inventory")
          .select("id, volumes, available_copies")
          .eq("book_id", ob.book_id)
          .maybeSingle();
        if (inv) {
          const qty = Number(ob.quantity ?? 1) || 1;
          await supabase
            .from("book_inventory")
            .update({
              available_copies: Math.min(
                Number(inv.volumes ?? qty),
                Number(inv.available_copies ?? 0) + qty
              ),
            })
            .eq("id", inv.id);
        }
      }

      await supabase.from("library_card_books").delete().eq("card_id", id);
      const snapshots = await resolveBookSnapshots(supabase, null, 1, parsed.data.book_ids);
      await insertCardBooksAndDeductInventory(supabase, id, snapshots);
    }

    return {
      ok: true,
      id,
      audit_details: `action=${action}_library_card id=${id}`,
    };
  }

  throw new AdminMutationError(`Unknown library_cards action: ${action}`, 400);
}
