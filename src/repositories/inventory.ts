import type { SupabaseClient } from "@supabase/supabase-js";
import { safeDecryptData } from "@/lib/crypto/fernet";
import { AdminMutationError } from "@/repositories/shared";

export async function queryInventory(supabase: SupabaseClient) {
  const [invRes, booksRes] = await Promise.all([
    supabase
      .from("book_inventory")
      .select(
        "id, book_id, volumes, available_copies, damaged_copies, lost_copies, shelf_location, status, created_at"
      )
      .order("id", { ascending: false }),
    supabase
      .from("books")
      .select("id, call_number, title, author, isbn, is_borrowable"),
  ]);
  if (invRes.error) throw invRes.error;
  const bookMap = new Map<
    number,
    {
      call_number: string | null;
      title: string | null;
      author: string | null;
      isbn: string | null;
      is_borrowable: boolean;
    }
  >();
  for (const b of booksRes.data ?? []) {
    bookMap.set(b.id as number, b);
  }
  const rows = (invRes.data ?? []).map((inv) => {
    const b = bookMap.get(inv.book_id as number);
    return {
      ...inv,
      book_title: b ? safeDecryptData(b.title) : `Book #${inv.book_id}`,
      book_author: b ? safeDecryptData(b.author) : "—",
      call_number: b?.call_number ?? "",
      isbn: b ? safeDecryptData(b.isbn) : "",
      is_borrowable: b?.is_borrowable ?? true,
    };
  });
  return { rows };
}

export async function mutateInventory(
  supabase: SupabaseClient,
  id: number | null,
  payload: Record<string, unknown>
) {
  if (!id) throw new AdminMutationError("Inventory ID is required.");

  const volumes = Math.max(0, Number(payload.volumes ?? 0) || 0);
  const availableCopies = Math.max(0, Number(payload.available_copies ?? 0) || 0);
  const damagedCopies = Math.max(0, Number(payload.damaged_copies ?? 0) || 0);
  const lostCopies = Math.max(0, Number(payload.lost_copies ?? 0) || 0);
  const shelfLocation = String(payload.shelf_location ?? "").trim() || null;
  const status = String(payload.status ?? "Available").trim() || "Available";

  const { data: updatedInv, error } = await supabase
    .from("book_inventory")
    .update({
      volumes,
      available_copies: Math.min(volumes, availableCopies),
      damaged_copies: damagedCopies,
      lost_copies: lostCopies,
      shelf_location: shelfLocation,
      status,
    })
    .eq("id", id)
    .select("book_id")
    .single();

  if (error) throw new AdminMutationError(error.message, 500);

  if (updatedInv?.book_id && payload.is_borrowable !== undefined) {
    await supabase
      .from("books")
      .update({ is_borrowable: Boolean(payload.is_borrowable) })
      .eq("id", updatedInv.book_id);
  }

  return { ok: true, id };
}
