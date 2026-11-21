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

function buildGeneratedCopies(
  bookId: number,
  volumes: number,
  availableCopies: number,
  damagedCopies: number,
  lostCopies: number,
  shelfLocation: string
) {
  const cap = Math.max(1, Math.min(volumes || 1, 25));
  const list: Array<{
    copy_number: number;
    accession_number: string;
    condition: string;
    circulation_status: string;
    condition_notes: string;
    shelf_location: string;
  }> = [];

  for (let c = 1; c <= cap; c++) {
    let condition = "Good";
    let circulation_status = "Available";
    let condition_notes = "";
    if (c <= damagedCopies) {
      condition = "Damaged";
      circulation_status = "Unusable";
      condition_notes = `Copy #${c} flagged as damaged — awaiting repair/replacement`;
    } else if (c <= damagedCopies + lostCopies) {
      condition = "Lost";
      circulation_status = "Unusable";
      condition_notes = `Copy #${c} reported lost`;
    } else if (c > damagedCopies + lostCopies + availableCopies) {
      condition = "Good";
      circulation_status = "Borrowed";
    }
    list.push({
      copy_number: c,
      accession_number: `ICPL-${String(bookId).padStart(4, "0")}-C${String(c).padStart(2, "0")}`,
      condition,
      circulation_status,
      condition_notes,
      shelf_location: shelfLocation || "Main Stack",
    });
  }
  return list;
}

export async function queryInventory(supabase: SupabaseClient) {
  const [invRes, booksRes, copiesRes] = await Promise.all([
    supabase
      .from("book_inventory")
      .select(
        "id, book_id, volumes, available_copies, damaged_copies, lost_copies, shelf_location, status, created_at"
      )
      .order("id", { ascending: false }),
    supabase
      .from("books")
      .select("id, call_number, title, author, isbn, is_borrowable"),
    supabase
      .from("book_copies")
      .select(
        "id, book_id, copy_number, accession_number, condition, circulation_status, condition_notes, shelf_location"
      )
      .order("copy_number", { ascending: true }),
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

  const copiesByBook = new Map<number, Record<string, unknown>[]>();
  if (!copiesRes.error && copiesRes.data) {
    for (const cp of copiesRes.data) {
      const bid = Number(cp.book_id);
      const list = copiesByBook.get(bid) ?? [];
      list.push(cp);
      copiesByBook.set(bid, list);
    }
  }

  const rows = (invRes.data ?? []).map((inv) => {
    const bookId = Number(inv.book_id);
    const b = bookMap.get(bookId);
    const volumes = Number(inv.volumes ?? 1);
    const availableCopies = Number(inv.available_copies ?? 0);
    const damagedCopies = Number(inv.damaged_copies ?? 0);
    const lostCopies = Number(inv.lost_copies ?? 0);
    const borrowedCopies = Math.max(0, volumes - availableCopies - damagedCopies - lostCopies);
    const dbCopies = copiesByBook.get(bookId);
    const copies =
      dbCopies && dbCopies.length > 0
        ? dbCopies
        : buildGeneratedCopies(
            bookId,
            volumes,
            availableCopies,
            damagedCopies,
            lostCopies,
            String(inv.shelf_location ?? "")
          );

    const damagedAccessions = copies
      .filter((cp) => String(cp.condition) === "Damaged")
      .map((cp) => String(cp.accession_number))
      .join(", ");

    return {
      ...inv,
      book_title: b ? safeDecryptData(b.title) : `Book #${inv.book_id}`,
      book_author: b ? safeDecryptData(b.author) : "—",
      call_number: b?.call_number ?? "",
      isbn: b ? safeDecryptData(b.isbn) : "",
      is_borrowable: b?.is_borrowable ?? true,
      borrowed_copies: borrowedCopies,
      condition_status: computeConditionSummary(availableCopies, damagedCopies, lostCopies),
      damaged_accessions:
        damagedAccessions || (damagedCopies > 0 ? `${damagedCopies} copy/copies` : "None"),
      copies,
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
