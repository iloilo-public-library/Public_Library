import type { SupabaseClient } from "@supabase/supabase-js";
import { safeDecryptData } from "@/lib/crypto/fernet";
import { AdminMutationError } from "@/repositories/shared";

export function computeConditionSummary(
  availableCopies: number,
  damagedCopies: number,
  lostCopies: number,
  destroyedCopies = 0
): string {
  const hasDamaged = damagedCopies > 0;
  const hasLost = lostCopies > 0;
  const hasDestroyed = destroyedCopies > 0;

  const issues: string[] = [];
  if (hasDamaged) issues.push("Damaged");
  if (hasDestroyed) issues.push("Destroyed");
  if (hasLost) issues.push("Lost");

  if (issues.length > 1) {
    return `${issues.join(" & ")} Copies`;
  }
  if (hasDestroyed) return "Has Destroyed Copies";
  if (hasDamaged) return "Has Damaged Copies";
  if (hasLost) return "Has Lost Copies";
  if (availableCopies <= 0) return "Out of Stock";
  return "All Good";
}

export function buildGeneratedCopies(
  bookId: number,
  volumes: number,
  availableCopies: number,
  damagedCopies: number,
  lostCopies: number,
  shelfLocation: string,
  destroyedCopies = 0,
  accessionPrefix?: string | null
) {
  const cap = Math.max(1, Math.min(volumes || 1, 100));
  const prefix = (
    accessionPrefix?.trim() ||
    `ICPL-${String(bookId).padStart(4, "0")}`
  )
    .toUpperCase()
    .replace(/\s+/g, "-");

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
    } else if (c <= damagedCopies + destroyedCopies) {
      condition = "Destroyed";
      circulation_status = "Unusable";
      condition_notes = `Copy #${c} marked as destroyed / beyond repair`;
    } else if (c <= damagedCopies + destroyedCopies + lostCopies) {
      condition = "Lost";
      circulation_status = "Unusable";
      condition_notes = `Copy #${c} reported lost`;
    } else if (c > damagedCopies + destroyedCopies + lostCopies + availableCopies) {
      condition = "Good";
      circulation_status = "Borrowed";
    }
    list.push({
      copy_number: c,
      accession_number: `${prefix}-C${String(c).padStart(3, "0")}`,
      condition,
      circulation_status,
      condition_notes,
      shelf_location: shelfLocation || "Main Stack",
    });
  }
  return list;
}

export async function syncBookCopiesInDb(
  supabase: SupabaseClient,
  bookId: number,
  copiesPayload: unknown
): Promise<{
  synced: boolean;
  volumes: number;
  availableCopies: number;
  damagedCopies: number;
  destroyedCopies: number;
  lostCopies: number;
} | null> {
  if (!Array.isArray(copiesPayload) || copiesPayload.length === 0) return null;

  let availableCopies = 0;
  let damagedCopies = 0;
  let destroyedCopies = 0;
  let lostCopies = 0;

  for (let i = 0; i < copiesPayload.length; i++) {
    const raw = copiesPayload[i] as Record<string, unknown>;
    const copyNumber = Number(raw.copy_number ?? i + 1) || i + 1;
    const accessionNumber =
      String(raw.accession_number ?? "").trim() ||
      `ICPL-${String(bookId).padStart(4, "0")}-C${String(copyNumber).padStart(3, "0")}`;
    const condition = String(raw.condition ?? "Good").trim() || "Good";
    const isUnusable =
      condition === "Damaged" ||
      condition === "Destroyed" ||
      condition === "Lost" ||
      condition === "Under Repair";
    const circulationStatus = isUnusable
      ? "Unusable"
      : String(raw.circulation_status ?? "Available").trim() || "Available";
    const conditionNotes = String(raw.condition_notes ?? "").trim();
    const shelfLocation = String(raw.shelf_location ?? "").trim() || null;

    if (condition === "Damaged" || condition === "Under Repair") {
      damagedCopies++;
    } else if (condition === "Destroyed") {
      destroyedCopies++;
    } else if (condition === "Lost") {
      lostCopies++;
    } else if (circulationStatus === "Available") {
      availableCopies++;
    }

    try {
      if (raw.id) {
        await supabase
          .from("book_copies")
          .update({
            condition,
            circulation_status: circulationStatus,
            condition_notes: conditionNotes,
            shelf_location: shelfLocation,
          })
          .eq("id", Number(raw.id));
      } else {
        await supabase.from("book_copies").upsert(
          {
            book_id: bookId,
            copy_number: copyNumber,
            accession_number: accessionNumber,
            condition,
            circulation_status: circulationStatus,
            condition_notes: conditionNotes,
            shelf_location: shelfLocation,
          },
          { onConflict: "book_id,copy_number" }
        );
      }
    } catch {
      // Graceful fallback if book_copies table or Destroyed check constraint not yet migrated
    }
  }

  return {
    synced: true,
    volumes: copiesPayload.length,
    availableCopies,
    damagedCopies,
    destroyedCopies,
    lostCopies,
  };
}

export async function queryInventory(supabase: SupabaseClient) {
  const [invRes, booksRes, copiesRes] = await Promise.all([
    supabase
      .from("book_inventory")
      .select("*")
      .order("id", { ascending: false }),
    supabase
      .from("books")
      .select("id, call_number, title, author, isbn, category, class, publisher, published_date, is_borrowable"),
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
      category: string | null;
      class: string | null;
      publisher: string | null;
      published_date: string | null;
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
    const dbCopies = copiesByBook.get(bookId);

    const dbDestroyedCount = (dbCopies ?? []).filter(
      (cp) => String(cp.condition) === "Destroyed"
    ).length;
    const destroyedCopies = Math.max(
      Number((inv as Record<string, unknown>).destroyed_copies ?? 0),
      dbDestroyedCount
    );

    const borrowedCopies = Math.max(
      0,
      volumes - availableCopies - damagedCopies - destroyedCopies - lostCopies
    );

    const callNumber = b?.call_number ?? "";
    const catalogCode =
      callNumber.trim() || `ICPL-BK-${String(bookId).padStart(4, "0")}`;

    const copies =
      dbCopies && dbCopies.length > 0
        ? dbCopies
        : buildGeneratedCopies(
            bookId,
            volumes,
            availableCopies,
            damagedCopies,
            lostCopies,
            String(inv.shelf_location ?? ""),
            destroyedCopies,
            callNumber || null
          );

    const flaggedAccessions = copies
      .filter((cp) => {
        const cond = String(cp.condition);
        return (
          cond === "Damaged" ||
          cond === "Destroyed" ||
          cond === "Lost" ||
          cond === "Under Repair"
        );
      })
      .map((cp) => `${String(cp.accession_number)} (${String(cp.condition)})`)
      .join(", ");

    return {
      ...inv,
      catalog_code: catalogCode,
      book_title: b ? safeDecryptData(b.title) : `Book #${inv.book_id}`,
      book_author: b ? safeDecryptData(b.author) : "—",
      call_number: callNumber,
      isbn: b ? safeDecryptData(b.isbn) : "",
      category: b ? safeDecryptData(b.category) : "",
      class: b ? safeDecryptData(b.class) : "",
      publisher: b ? safeDecryptData(b.publisher) : "",
      published_date: b?.published_date ?? "",
      is_borrowable: b?.is_borrowable ?? true,
      borrowed_copies: borrowedCopies,
      destroyed_copies: destroyedCopies,
      condition_status: computeConditionSummary(
        availableCopies,
        damagedCopies,
        lostCopies,
        destroyedCopies
      ),
      damaged_accessions:
        flaggedAccessions ||
        (damagedCopies + destroyedCopies + lostCopies > 0
          ? `${damagedCopies + destroyedCopies + lostCopies} flagged copy/copies`
          : "None"),
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

  const { data: currentInv } = await supabase
    .from("book_inventory")
    .select("book_id")
    .eq("id", id)
    .single();

  const bookId = Number(currentInv?.book_id ?? payload.book_id ?? 0);

  let volumes = Math.max(0, Number(payload.volumes ?? 0) || 0);
  let availableCopies = Math.max(0, Number(payload.available_copies ?? 0) || 0);
  let damagedCopies = Math.max(0, Number(payload.damaged_copies ?? 0) || 0);
  let destroyedCopies = Math.max(0, Number(payload.destroyed_copies ?? 0) || 0);
  let lostCopies = Math.max(0, Number(payload.lost_copies ?? 0) || 0);

  if (bookId && Array.isArray(payload.copies) && payload.copies.length > 0) {
    const synced = await syncBookCopiesInDb(supabase, bookId, payload.copies);
    if (synced && payload.sync_counts_from_copies !== false) {
      volumes = Math.max(volumes, synced.volumes);
      availableCopies = synced.availableCopies;
      damagedCopies = synced.damagedCopies;
      destroyedCopies = synced.destroyedCopies;
      lostCopies = synced.lostCopies;
    }
  }

  const shelfLocation = String(payload.shelf_location ?? "").trim() || null;
  const status = String(payload.status ?? "Available").trim() || "Available";
  const conditionStatus = computeConditionSummary(
    availableCopies,
    damagedCopies,
    lostCopies,
    destroyedCopies
  );

  const baseUpdate: Record<string, unknown> = {
    volumes,
    available_copies: Math.min(volumes, availableCopies),
    damaged_copies: damagedCopies,
    lost_copies: lostCopies,
    shelf_location: shelfLocation,
    status,
  };

  let { data: updatedInv, error } = await supabase
    .from("book_inventory")
    .update({
      ...baseUpdate,
      destroyed_copies: destroyedCopies,
      condition_status: conditionStatus,
    })
    .eq("id", id)
    .select("book_id")
    .single();

  if (error) {
    // Fallback if migration 004/009 columns (destroyed_copies / condition_status) aren't in DB yet
    const retry = await supabase
      .from("book_inventory")
      .update(baseUpdate)
      .eq("id", id)
      .select("book_id")
      .single();
    if (retry.error) throw new AdminMutationError(retry.error.message, 500);
    updatedInv = retry.data;
  }

  if (updatedInv?.book_id && payload.is_borrowable !== undefined) {
    await supabase
      .from("books")
      .update({ is_borrowable: Boolean(payload.is_borrowable) })
      .eq("id", updatedInv.book_id);
  }

  return { ok: true, id };
}
