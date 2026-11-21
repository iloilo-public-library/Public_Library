import type { SupabaseClient } from "@supabase/supabase-js";
import { safeDecryptData } from "@/lib/crypto/fernet";
import { AdminMutationError } from "@/repositories/shared";

function computeConditionSummary(
  availableCopies: number,
  damagedCopies: number,
  lostCopies: number
): string {
  if (damagedCopies > 0 && lostCopies > 0) return "Damaged & Lost Copies";
  if (damagedCopies > 0) return "Has Damaged Copies";
  if (lostCopies > 0) return "Has Lost Copies";
  if (availableCopies <= 0) return "Out of Stock";
  return "All Good";
}

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
    const volumes = Number(inv?.volumes ?? 1);
    const availableCopies = Number(inv?.available_copies ?? 1);
    const damagedCopies = Number(inv?.damaged_copies ?? 0);
    const lostCopies = Number(inv?.lost_copies ?? 0);
    return {
      ...b,
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
      lost_copies: lostCopies,
      condition_status: computeConditionSummary(availableCopies, damagedCopies, lostCopies),
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
    title,
    author,
    isbn,
    call_number: String(payload.call_number ?? "").trim() || null,
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
