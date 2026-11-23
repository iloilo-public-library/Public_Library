import type { SupabaseClient } from "@supabase/supabase-js";
import { safeDecryptData } from "@/lib/crypto/fernet";
import { AdminMutationError } from "@/repositories/shared";
import {
  buildGeneratedCopies,
  computeConditionSummary,
  syncBookCopiesInDb,
} from "@/repositories/inventory";

export async function queryBooks(supabase: SupabaseClient) {
  const [booksRes, invRes, copiesRes] = await Promise.all([
    supabase
      .from("books")
      .select(
        "id, call_number, date_received, class, author, title, isbn, edition, page_count, category, source_of_fund, cost_price, publisher, copy_right, subtitle, published_date, description, language, thumbnail_url, api_source, is_borrowable, created_at, updated_at"
      )
      .order("id", { ascending: false }),
    supabase
      .from("book_inventory")
      .select("*"),
    supabase
      .from("book_copies")
      .select(
        "id, book_id, copy_number, accession_number, condition, circulation_status, condition_notes, shelf_location"
      )
      .order("copy_number", { ascending: true }),
  ]);
  if (booksRes.error) throw booksRes.error;
  const invMap = new Map<number, Record<string, unknown>>();
  for (const inv of invRes.data ?? []) {
    invMap.set(inv.book_id as number, inv);
  }
  const copiesByBook = new Map<number, Record<string, unknown>[]>();
  if (!copiesRes.error && copiesRes.data) {
    for (const cp of copiesRes.data) {
      const bid = Number(cp.book_id);
      const list = copiesByBook.get(bid) ?? [];
      list.push(cp);
      copiesByBook.set(bid, list);
    }
  }

  const rows = (booksRes.data ?? []).map((b) => {
    const bookId = Number(b.id);
    const inv = invMap.get(bookId);
    const volumes = Number(inv?.volumes ?? 1);
    const availableCopies = Number(inv?.available_copies ?? 1);
    const damagedCopies = Number(inv?.damaged_copies ?? 0);
    const lostCopies = Number(inv?.lost_copies ?? 0);
    const dbCopies = copiesByBook.get(bookId);

    const dbDestroyedCount = (dbCopies ?? []).filter(
      (cp) => String(cp.condition) === "Destroyed"
    ).length;
    const destroyedCopies = Math.max(
      Number(inv?.destroyed_copies ?? 0),
      dbDestroyedCount
    );
    const shelfLocation = String(inv?.shelf_location ?? "");
    const callNumber = String(b.call_number ?? "").trim();
    const catalogCode = callNumber || `ICPL-BK-${String(bookId).padStart(4, "0")}`;

    const copies =
      dbCopies && dbCopies.length > 0
        ? dbCopies
        : buildGeneratedCopies(
            bookId,
            volumes,
            availableCopies,
            damagedCopies,
            lostCopies,
            shelfLocation,
            destroyedCopies,
            callNumber || null
          );

    return {
      ...b,
      catalog_code: catalogCode,
      title: safeDecryptData(b.title),
      author: safeDecryptData(b.author),
      isbn: safeDecryptData(b.isbn),
      class: safeDecryptData(b.class),
      category: safeDecryptData(b.category),
      publisher: safeDecryptData(b.publisher),
      volumes,
      total_copies: volumes,
      available_copies: availableCopies,
      damaged_copies: damagedCopies,
      destroyed_copies: destroyedCopies,
      lost_copies: lostCopies,
      condition_status: computeConditionSummary(
        availableCopies,
        damagedCopies,
        lostCopies,
        destroyedCopies
      ),
      shelf_location: shelfLocation,
      inventory_status: String(inv?.status ?? "Available"),
      copies,
    };
  });
  return { rows };
}

export async function mutateBooks(
  supabase: SupabaseClient,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  if (action === "delete") {
    if (!id) throw new AdminMutationError("Book ID is required.");
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, deletedId: id };
  }

  const title = String(payload.title ?? "").trim();
  const author = String(payload.author ?? "").trim();
  const isbn = String(payload.isbn ?? "").trim();
  if (!title || !author || !isbn) {
    throw new AdminMutationError("Title, Author, and ISBN are required.");
  }

  const callNumber =
    String(payload.call_number ?? payload.catalog_code ?? "").trim() || null;
  const accessionPrefix = String(payload.accession_prefix ?? "").trim() || null;
  const category = String(payload.category ?? "").trim();
  const genreClass = String(payload.class ?? payload.genre ?? "").trim();
  const publisher = String(payload.publisher ?? "").trim();

  let volumes = Math.max(
    0,
    Number(payload.copies_to_add ?? payload.volumes ?? 1) || 0
  );
  let damaged = Math.max(0, Number(payload.damaged_copies ?? 0) || 0);
  let destroyed = Math.max(0, Number(payload.destroyed_copies ?? 0) || 0);
  let lost = Math.max(0, Number(payload.lost_copies ?? 0) || 0);
  let available =
    payload.available_copies !== undefined
      ? Math.max(0, Number(payload.available_copies) || 0)
      : Math.max(0, volumes - damaged - destroyed - lost);

  const shelfLocation = String(payload.shelf_location ?? "").trim() || null;
  const invStatus = String(payload.inventory_status ?? "Available").trim() || "Available";

  const bookData: Record<string, unknown> = {
    title,
    author,
    isbn,
    call_number: callNumber,
    class: genreClass || null,
    category: category || null,
    publisher: publisher || null,
    edition: String(payload.edition ?? "").trim() || null,
    published_date: String(payload.published_date ?? "").trim() || null,
    subtitle: String(payload.subtitle ?? "").trim() || null,
    description: String(payload.description ?? "").trim() || null,
    language: String(payload.language ?? "en").trim().slice(0, 5) || "en",
    thumbnail_url: String(payload.thumbnail_url ?? "").trim() || null,
    api_source: String(payload.api_source ?? "Manual").trim() || "Manual",
    source_of_fund: String(payload.source_of_fund ?? "").trim() || null,
    copy_right: String(payload.copy_right ?? "").trim() || null,
    cost_price: payload.cost_price ? Number(payload.cost_price) : null,
    page_count: payload.page_count ? Math.max(0, Number(payload.page_count)) : null,
    date_received: String(payload.date_received ?? "").trim() || null,
    is_borrowable: payload.is_borrowable !== false && payload.is_borrowable !== "false",
  };

  if (action === "create") {
    const { data: inserted, error } = await supabase
      .from("books")
      .insert(bookData)
      .select("id")
      .single();
    if (error || !inserted) {
      throw new AdminMutationError(error?.message || "Failed to add book.", 500);
    }

    const newBookId = Number(inserted.id);
    const conditionStatus = computeConditionSummary(available, damaged, lost, destroyed);
    const baseInv = {
      book_id: newBookId,
      volumes,
      available_copies: available,
      damaged_copies: damaged,
      lost_copies: lost,
      shelf_location: shelfLocation,
      status: invStatus,
    };

    const invInsert = await supabase.from("book_inventory").insert({
      ...baseInv,
      destroyed_copies: destroyed,
      condition_status: conditionStatus,
    });
    if (invInsert.error) {
      await supabase.from("book_inventory").insert(baseInv);
    }

    // Seed deterministic physical book_copies rows
    const prefix = (
      accessionPrefix ||
      callNumber ||
      `ICPL-${String(newBookId).padStart(4, "0")}`
    )
      .toUpperCase()
      .replace(/\s+/g, "-");

    const generatedCopies = buildGeneratedCopies(
      newBookId,
      Math.max(1, Math.min(volumes, 500)),
      available,
      damaged,
      lost,
      shelfLocation || "Main Stack",
      destroyed,
      prefix
    ).map((cp) => ({
      book_id: newBookId,
      copy_number: cp.copy_number,
      accession_number: cp.accession_number,
      condition: cp.condition,
      circulation_status: cp.circulation_status,
      condition_notes: cp.condition_notes,
      shelf_location: shelfLocation,
    }));

    try {
      await supabase
        .from("book_copies")
        .upsert(generatedCopies, { onConflict: "book_id,copy_number" });
    } catch {
      // Ignore if book_copies table not migrated yet
    }

    return { ok: true, id: newBookId };
  }

  if (action === "update") {
    if (!id) throw new AdminMutationError("Book ID is required.");
    const { error } = await supabase.from("books").update(bookData).eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);

    if (Array.isArray(payload.copies) && payload.copies.length > 0) {
      const synced = await syncBookCopiesInDb(supabase, id, payload.copies);
      if (synced && payload.sync_counts_from_copies !== false) {
        volumes = Math.max(volumes, synced.volumes);
        available = synced.availableCopies;
        damaged = synced.damagedCopies;
        destroyed = synced.destroyedCopies;
        lost = synced.lostCopies;
      }
    }

    const conditionStatus = computeConditionSummary(available, damaged, lost, destroyed);
    const baseInvUpdate = {
      volumes,
      available_copies: Math.min(volumes, available),
      damaged_copies: damaged,
      lost_copies: lost,
      shelf_location: shelfLocation,
      status: invStatus,
    };

    const { data: existingInv } = await supabase
      .from("book_inventory")
      .select("id")
      .eq("book_id", id)
      .limit(1);

    if (existingInv && existingInv.length > 0) {
      const upd = await supabase
        .from("book_inventory")
        .update({
          ...baseInvUpdate,
          destroyed_copies: destroyed,
          condition_status: conditionStatus,
        })
        .eq("book_id", id);
      if (upd.error) {
        await supabase.from("book_inventory").update(baseInvUpdate).eq("book_id", id);
      }
    } else {
      const ins = await supabase.from("book_inventory").insert({
        book_id: id,
        ...baseInvUpdate,
        destroyed_copies: destroyed,
        condition_status: conditionStatus,
      });
      if (ins.error) {
        await supabase.from("book_inventory").insert({ book_id: id, ...baseInvUpdate });
      }
    }
    return { ok: true, id };
  }

  throw new AdminMutationError(`Unknown books action: ${action}`);
}
