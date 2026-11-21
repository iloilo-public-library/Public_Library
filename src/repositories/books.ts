import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authorBlindIndex,
  isbnBlindIndex,
  maybeEncryptData,
  safeDecryptData,
  titleBlindIndex,
} from "@/lib/crypto/fernet";
import { AdminMutationError } from "@/repositories/shared";

export async function queryBooks(supabase: SupabaseClient) {
  const [booksRes, invRes] = await Promise.all([
    supabase
      .from("books")
      .select(
        "id, call_number, date_received, class, author, title, isbn, edition, page_count, category, source_of_fund, cost_price, publisher, copy_right, subtitle, published_date, description, language, thumbnail_url, api_source, is_borrowable, created_at, updated_at"
      )
      .order("id", { ascending: false }),
    supabase
      .from("book_inventory")
      .select(
        "book_id, volumes, available_copies, damaged_copies, lost_copies, shelf_location, status"
      ),
  ]);
  if (booksRes.error) throw booksRes.error;
  const invMap = new Map<number, Record<string, unknown>>();
  for (const inv of invRes.data ?? []) {
    invMap.set(inv.book_id as number, inv);
  }
  const rows = (booksRes.data ?? []).map((b) => {
    const inv = invMap.get(b.id as number);
    return {
      ...b,
      title: safeDecryptData(b.title),
      author: safeDecryptData(b.author),
      isbn: safeDecryptData(b.isbn),
      class: safeDecryptData(b.class),
      category: safeDecryptData(b.category),
      publisher: safeDecryptData(b.publisher),
      volumes: Number(inv?.volumes ?? 1),
      total_copies: Number(inv?.volumes ?? 1),
      available_copies: Number(inv?.available_copies ?? 1),
      damaged_copies: Number(inv?.damaged_copies ?? 0),
      lost_copies: Number(inv?.lost_copies ?? 0),
      shelf_location: String(inv?.shelf_location ?? ""),
      inventory_status: String(inv?.status ?? "Available"),
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

  const category = String(payload.category ?? "").trim();
  const genreClass = String(payload.class ?? "").trim();
  const publisher = String(payload.publisher ?? "").trim();
  const volumes = Math.max(0, Number(payload.volumes ?? 1) || 0);
  const damaged = Math.max(0, Number(payload.damaged_copies ?? 0) || 0);
  const lost = Math.max(0, Number(payload.lost_copies ?? 0) || 0);
  const available = Math.max(0, volumes - damaged - lost);
  const shelfLocation = String(payload.shelf_location ?? "").trim() || null;
  const invStatus = String(payload.inventory_status ?? "Available").trim() || "Available";

  const bookData: Record<string, unknown> = {
    title: maybeEncryptData(title),
    title_index: titleBlindIndex(title),
    author: maybeEncryptData(author),
    author_index: authorBlindIndex(author),
    isbn: maybeEncryptData(isbn),
    isbn_index: isbnBlindIndex(isbn),
    call_number: String(payload.call_number ?? "").trim() || null,
    class: genreClass ? maybeEncryptData(genreClass) : null,
    category: category ? maybeEncryptData(category) : null,
    publisher: publisher ? maybeEncryptData(publisher) : null,
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
    await supabase.from("book_inventory").insert({
      book_id: inserted.id,
      volumes,
      available_copies: available,
      damaged_copies: damaged,
      lost_copies: lost,
      shelf_location: shelfLocation,
      status: invStatus,
    });
    return { ok: true, id: inserted.id };
  }

  if (action === "update") {
    if (!id) throw new AdminMutationError("Book ID is required.");
    const { error } = await supabase.from("books").update(bookData).eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);

    const { data: existingInv } = await supabase
      .from("book_inventory")
      .select("id")
      .eq("book_id", id)
      .limit(1);

    if (existingInv && existingInv.length > 0) {
      await supabase
        .from("book_inventory")
        .update({
          volumes,
          available_copies: available,
          damaged_copies: damaged,
          lost_copies: lost,
          shelf_location: shelfLocation,
          status: invStatus,
        })
        .eq("book_id", id);
    } else {
      await supabase.from("book_inventory").insert({
        book_id: id,
        volumes,
        available_copies: available,
        damaged_copies: damaged,
        lost_copies: lost,
        shelf_location: shelfLocation,
        status: invStatus,
      });
    }
    return { ok: true, id };
  }

  throw new AdminMutationError(`Unknown books action: ${action}`);
}
