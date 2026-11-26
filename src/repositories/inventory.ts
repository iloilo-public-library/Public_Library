import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/config/constants";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { safeDecryptData } from "@/lib/crypto/fernet";
import { mapDatabaseError } from "@/lib/errors";
import { AdminMutationError } from "@/repositories/shared";
import {
  bookCopyAddPayloadSchema,
  bookCopyDeletePayloadSchema,
  bookCopyInputSchema,
  bookCopyRetirePayloadSchema,
  bookCopyUpdatePayloadSchema,
  inventoryUpdatePayloadSchema,
} from "@/validators/admin";

export interface InventoryQueryOptions {
  page?: number;
  pageSize?: number;
  q?: string;
  available?: boolean;
  damaged?: boolean;
  condition?: string;
  sort?: string;
  order?: "asc" | "desc";
}

const MAX_PAGE_SIZE = 200;
const DB_FETCH_CAP = 2000;

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

function isUnusableCondition(condition: string): boolean {
  return (
    condition === "Damaged" ||
    condition === "Destroyed" ||
    condition === "Lost" ||
    condition === "Under Repair"
  );
}

export async function recomputeBookInventoryCounts(
  supabase: SupabaseClient,
  bookId: number
): Promise<{
  volumes: number;
  availableCopies: number;
  borrowedCopies: number;
  damagedCopies: number;
  destroyedCopies: number;
  lostCopies: number;
}> {
  const { data: copies, error } = await supabase
    .from("book_copies")
    .select("id, condition, circulation_status")
    .eq("book_id", bookId)
    .limit(1000);

  if (error) {
    throw mapDatabaseError(error, "Failed to read book copies.");
  }

  let availableCopies = 0;
  let borrowedCopies = 0;
  let damagedCopies = 0;
  let destroyedCopies = 0;
  let lostCopies = 0;

  const list = copies ?? [];
  for (const cp of list) {
    const cond = String(cp.condition ?? "Good");
    const status = String(cp.circulation_status ?? "Available");
    if (status === "Borrowed") {
      borrowedCopies++;
    } else if (cond === "Damaged" || cond === "Under Repair") {
      damagedCopies++;
    } else if (cond === "Destroyed") {
      destroyedCopies++;
    } else if (cond === "Lost") {
      lostCopies++;
    } else if (status === "Available") {
      availableCopies++;
    }
  }

  const volumes = list.length;
  const conditionStatus = computeConditionSummary(
    availableCopies,
    damagedCopies,
    lostCopies,
    destroyedCopies
  );
  const invStatus = availableCopies > 0 ? "Available" : "Out of Stock";

  const baseUpdate = {
    volumes,
    available_copies: availableCopies,
    borrowed_copies: borrowedCopies,
    damaged_copies: damagedCopies,
    lost_copies: lostCopies,
    status: invStatus,
  };

  const { data: existingInv } = await supabase
    .from("book_inventory")
    .select("id")
    .eq("book_id", bookId)
    .maybeSingle();

  if (existingInv) {
    const upd = await supabase
      .from("book_inventory")
      .update({
        ...baseUpdate,
        destroyed_copies: destroyedCopies,
        condition_status: conditionStatus,
      })
      .eq("book_id", bookId);
    if (upd.error) {
      await supabase.from("book_inventory").update(baseUpdate).eq("book_id", bookId);
    }
  } else {
    const ins = await supabase.from("book_inventory").insert({
      book_id: bookId,
      ...baseUpdate,
      destroyed_copies: destroyedCopies,
      condition_status: conditionStatus,
    });
    if (ins.error) {
      await supabase.from("book_inventory").insert({ book_id: bookId, ...baseUpdate });
    }
  }

  return {
    volumes,
    availableCopies,
    borrowedCopies,
    damagedCopies,
    destroyedCopies,
    lostCopies,
  };
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

  const validatedCopies = copiesPayload.map((raw, idx) => {
    const parsed = bookCopyInputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || `Invalid copy data at index ${idx}.`,
        400
      );
    }
    return parsed.data;
  });

  // Check duplicate accession numbers within the payload itself
  const seenAccessions = new Set<string>();
  const normalizedItems = validatedCopies.map((item, i) => {
    const copyNumber = Number(item.copy_number ?? i + 1) || i + 1;
    const accessionNumber =
      String(item.accession_number ?? "").trim() ||
      `ICPL-${String(bookId).padStart(4, "0")}-C${String(copyNumber).padStart(3, "0")}`;
    const key = accessionNumber.toUpperCase();
    if (seenAccessions.has(key)) {
      throw new AdminMutationError(
        `Duplicate accession number in request: ${accessionNumber}.`,
        409
      );
    }
    seenAccessions.add(key);
    return { item, copyNumber, accessionNumber };
  });

  // Load existing copies for this book to enforce borrowed-copy protection
  const { data: existingBookCopies } = await supabase
    .from("book_copies")
    .select("id, copy_number, accession_number, circulation_status")
    .eq("book_id", bookId)
    .limit(1000);

  const existingById = new Map<number, { circulation_status: string; accession_number: string }>();
  for (const row of existingBookCopies ?? []) {
    existingById.set(Number(row.id), {
      circulation_status: String(row.circulation_status ?? "Available"),
      accession_number: String(row.accession_number ?? ""),
    });
  }

  // Check duplicate accession numbers against other records in book_copies
  const accessionList = normalizedItems.map((n) => n.accessionNumber);
  if (accessionList.length > 0) {
    const { data: dupAccessions } = await supabase
      .from("book_copies")
      .select("id, book_id, copy_number, accession_number")
      .in("accession_number", accessionList);

    for (const dup of dupAccessions ?? []) {
      const matchingItem = normalizedItems.find(
        (n) => n.accessionNumber.toUpperCase() === String(dup.accession_number).toUpperCase()
      );
      if (!matchingItem) continue;
      const sameRowById = matchingItem.item.id && Number(dup.id) === Number(matchingItem.item.id);
      const sameRowByBookCopy =
        !matchingItem.item.id &&
        Number(dup.book_id) === bookId &&
        Number(dup.copy_number) === matchingItem.copyNumber;
      if (!sameRowById && !sameRowByBookCopy) {
        throw new AdminMutationError(
          `A book copy with accession number ${dup.accession_number} already exists.`,
          409
        );
      }
    }
  }

  let availableCopies = 0;
  let damagedCopies = 0;
  let destroyedCopies = 0;
  let lostCopies = 0;

  for (const { item, copyNumber, accessionNumber } of normalizedItems) {
    const condition = item.condition;
    const isUnusable = isUnusableCondition(condition);
    const existing = item.id ? existingById.get(Number(item.id)) : undefined;

    if (existing && existing.circulation_status === "Borrowed" && isUnusable) {
      throw new AdminMutationError(
        "Cannot retire or mark a currently borrowed copy as unusable via inventory edit. Process a return or mark lost/damaged through circulation.",
        409
      );
    }

    const circulationStatus =
      existing && existing.circulation_status === "Borrowed"
        ? "Borrowed"
        : isUnusable
          ? "Unusable"
          : item.circulation_status;
    const conditionNotes = String(item.condition_notes ?? "").trim();
    const shelfLocation = String(item.shelf_location ?? "").trim() || null;

    if (condition === "Damaged" || condition === "Under Repair") {
      damagedCopies++;
    } else if (condition === "Destroyed") {
      destroyedCopies++;
    } else if (condition === "Lost") {
      lostCopies++;
    } else if (circulationStatus === "Available") {
      availableCopies++;
    }

    if (item.id) {
      const { error } = await supabase
        .from("book_copies")
        .update({
          accession_number: accessionNumber,
          condition,
          circulation_status: circulationStatus,
          condition_notes: conditionNotes,
          shelf_location: shelfLocation,
        })
        .eq("id", Number(item.id))
        .eq("book_id", bookId);
      if (error) {
        throw mapDatabaseError(error, "Failed to update book copy.");
      }
    } else {
      const { error } = await supabase.from("book_copies").upsert(
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
      if (error) {
        throw mapDatabaseError(error, "Failed to save book copy.");
      }
    }
  }

  return {
    synced: true,
    volumes: normalizedItems.length,
    availableCopies,
    damagedCopies,
    destroyedCopies,
    lostCopies,
  };
}

export async function queryInventory(
  supabase: SupabaseClient,
  options: InventoryQueryOptions = {}
) {
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(options.pageSize ?? MAX_PAGE_SIZE))
  );
  const q = (options.q ?? "").trim().toLowerCase();
  const conditionFilter = (options.condition ?? "").trim().toLowerCase();
  const sortField = (options.sort ?? "id").trim().toLowerCase();
  const sortAsc = options.order === "asc";

  const [invRes, booksRes, copiesRes] = await Promise.all([
    supabase
      .from("book_inventory")
      .select("*")
      .order("id", { ascending: false })
      .limit(DB_FETCH_CAP),
    supabase
      .from("books")
      .select(
        "id, call_number, title, author, isbn, category, class, publisher, published_date, is_borrowable"
      )
      .limit(DB_FETCH_CAP),
    supabase
      .from("book_copies")
      .select(
        "id, book_id, copy_number, accession_number, condition, circulation_status, condition_notes, shelf_location"
      )
      .order("copy_number", { ascending: true })
      .limit(DB_FETCH_CAP * 5),
  ]);
  if (invRes.error) throw mapDatabaseError(invRes.error, "Failed to load inventory.");

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

  let rows = (invRes.data ?? []).map((inv) => {
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
      .filter((cp) => isUnusableCondition(String(cp.condition)))
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

  // Server-side filters
  if (options.available !== undefined) {
    rows = rows.filter((r) =>
      options.available ? Number(r.available_copies) > 0 : Number(r.available_copies) <= 0
    );
  }
  if (options.damaged !== undefined) {
    rows = rows.filter((r) => {
      const hasDamaged =
        Number(r.damaged_copies) > 0 ||
        Number(r.destroyed_copies) > 0 ||
        Number(r.lost_copies) > 0;
      return options.damaged ? hasDamaged : !hasDamaged;
    });
  }
  if (conditionFilter) {
    rows = rows.filter(
      (r) =>
        String(r.condition_status).toLowerCase().includes(conditionFilter) ||
        r.copies.some((cp: Record<string, unknown>) => String(cp.condition).toLowerCase() === conditionFilter)
    );
  }
  if (q) {
    rows = rows.filter((r) => {
      const hay = `${r.book_title} ${r.book_author} ${r.isbn} ${r.call_number} ${r.catalog_code} ${r.category} ${r.copies
        .map((cp: Record<string, unknown>) => String(cp.accession_number ?? ""))
        .join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }

  // Stable sort with id tie-breaker
  rows.sort((a, b) => {
    let cmp = 0;
    if (sortField === "title" || sortField === "book_title") {
      cmp = String(a.book_title).localeCompare(String(b.book_title));
    } else if (sortField === "volumes") {
      cmp = Number(a.volumes ?? 0) - Number(b.volumes ?? 0);
    } else if (sortField === "available" || sortField === "available_copies") {
      cmp = Number(a.available_copies ?? 0) - Number(b.available_copies ?? 0);
    } else if (sortField === "damaged" || sortField === "damaged_copies") {
      cmp = Number(a.damaged_copies ?? 0) - Number(b.damaged_copies ?? 0);
    } else {
      cmp = Number(a.id ?? 0) - Number(b.id ?? 0);
    }
    if (cmp === 0) {
      return Number(b.id ?? 0) - Number(a.id ?? 0);
    }
    return sortAsc ? cmp : -cmp;
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedRows = rows.slice(start, start + pageSize);

  return {
    rows: pagedRows,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export async function mutateInventory(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  await verifyRepositoryActor(supabase, session.userId, STAFF_ROLES);

  if (action === "add_copy") {
    const parsed = bookCopyAddPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid book copy payload.",
        400
      );
    }
    const { book_id: bookId, condition, condition_notes, shelf_location } = parsed.data;

    const { data: bookRow } = await supabase
      .from("books")
      .select("id, call_number")
      .eq("id", bookId)
      .maybeSingle();
    if (!bookRow) {
      throw new AdminMutationError("Book not found.", 404);
    }

    const { data: existingCopies } = await supabase
      .from("book_copies")
      .select("copy_number")
      .eq("book_id", bookId)
      .order("copy_number", { ascending: false })
      .limit(1);

    const nextCopyNumber = Number(existingCopies?.[0]?.copy_number ?? 0) + 1;
    const prefix = (
      String(bookRow.call_number ?? "").trim() ||
      `ICPL-${String(bookId).padStart(4, "0")}`
    )
      .toUpperCase()
      .replace(/\s+/g, "-");
    const accessionNumber =
      parsed.data.accession_number?.trim() ||
      `${prefix}-C${String(nextCopyNumber).padStart(3, "0")}`;

    const { data: dupAcc } = await supabase
      .from("book_copies")
      .select("id")
      .eq("accession_number", accessionNumber)
      .limit(1);
    if (dupAcc && dupAcc.length > 0) {
      throw new AdminMutationError(
        `A book copy with accession number ${accessionNumber} already exists.`,
        409
      );
    }

    const circulationStatus = isUnusableCondition(condition) ? "Unusable" : "Available";
    const { data: insertedCopy, error } = await supabase
      .from("book_copies")
      .insert({
        book_id: bookId,
        copy_number: nextCopyNumber,
        accession_number: accessionNumber,
        condition,
        circulation_status: circulationStatus,
        condition_notes: condition_notes || "",
        shelf_location: shelf_location || null,
      })
      .select("id, book_id, copy_number, accession_number, condition, circulation_status")
      .single();

    if (error || !insertedCopy) {
      throw mapDatabaseError(error, "Failed to add book copy.");
    }

    await recomputeBookInventoryCounts(supabase, bookId);
    return {
      ok: true,
      id: Number(insertedCopy.id),
      copy: insertedCopy,
      audit_details: `action=add_copy book_id=${bookId} copy_id=${insertedCopy.id} condition=${condition}`,
    };
  }

  if (action === "update_copy") {
    const parsed = bookCopyUpdatePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid book copy update payload.",
        400
      );
    }
    const copyId = id ?? parsed.data.copy_id ?? null;
    if (!copyId) {
      throw new AdminMutationError("Copy ID is required.", 400);
    }

    const { data: existingCopy } = await supabase
      .from("book_copies")
      .select("id, book_id, accession_number, condition, circulation_status")
      .eq("id", copyId)
      .maybeSingle();
    if (!existingCopy) {
      throw new AdminMutationError("Book copy not found.", 404);
    }

    const nextCondition = parsed.data.condition ?? String(existingCopy.condition ?? "Good");
    const nextIsUnusable = isUnusableCondition(nextCondition);

    if (
      String(existingCopy.circulation_status) === "Borrowed" &&
      (nextIsUnusable || parsed.data.circulation_status === "Unusable")
    ) {
      throw new AdminMutationError(
        "Cannot retire or mark a currently borrowed copy as unusable. Process it through circulation.",
        409
      );
    }

    if (
      parsed.data.accession_number &&
      parsed.data.accession_number !== existingCopy.accession_number
    ) {
      const { data: dupAcc } = await supabase
        .from("book_copies")
        .select("id")
        .eq("accession_number", parsed.data.accession_number)
        .neq("id", copyId)
        .limit(1);
      if (dupAcc && dupAcc.length > 0) {
        throw new AdminMutationError(
          `A book copy with accession number ${parsed.data.accession_number} already exists.`,
          409
        );
      }
    }

    const updateFields: Record<string, unknown> = {};
    if (parsed.data.accession_number !== undefined) {
      updateFields.accession_number = parsed.data.accession_number;
    }
    if (parsed.data.condition !== undefined) {
      updateFields.condition = nextCondition;
      if (nextIsUnusable) {
        updateFields.circulation_status = "Unusable";
      } else if (
        String(existingCopy.circulation_status) === "Unusable" &&
        parsed.data.circulation_status === undefined
      ) {
        updateFields.circulation_status = "Available";
      }
    }
    if (parsed.data.circulation_status !== undefined && !nextIsUnusable) {
      updateFields.circulation_status = parsed.data.circulation_status;
    }
    if (parsed.data.condition_notes !== undefined) {
      updateFields.condition_notes = parsed.data.condition_notes;
    }
    if (parsed.data.shelf_location !== undefined) {
      updateFields.shelf_location = parsed.data.shelf_location || null;
    }

    const { error } = await supabase
      .from("book_copies")
      .update(updateFields)
      .eq("id", copyId);
    if (error) {
      throw mapDatabaseError(error, "Failed to update book copy.");
    }

    const bookId = Number(existingCopy.book_id);
    await recomputeBookInventoryCounts(supabase, bookId);
    return {
      ok: true,
      id: copyId,
      book_id: bookId,
      audit_details: `action=update_copy book_id=${bookId} copy_id=${copyId} condition=${nextCondition}`,
    };
  }

  if (action === "retire_copy") {
    const parsed = bookCopyRetirePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid retire copy payload.",
        400
      );
    }
    const copyId = id ?? parsed.data.copy_id ?? null;
    if (!copyId) {
      throw new AdminMutationError("Copy ID is required.", 400);
    }

    const { data: existingCopy } = await supabase
      .from("book_copies")
      .select("id, book_id, circulation_status")
      .eq("id", copyId)
      .maybeSingle();
    if (!existingCopy) {
      throw new AdminMutationError("Book copy not found.", 404);
    }
    if (String(existingCopy.circulation_status) === "Borrowed") {
      throw new AdminMutationError(
        "Cannot retire a book copy that is currently borrowed.",
        409
      );
    }

    const retireCondition = parsed.data.condition;
    const notes = parsed.data.condition_notes || parsed.data.reason || `Retired (${retireCondition})`;

    const { error } = await supabase
      .from("book_copies")
      .update({
        condition: retireCondition,
        circulation_status: "Unusable",
        condition_notes: notes,
      })
      .eq("id", copyId);
    if (error) {
      throw mapDatabaseError(error, "Failed to retire book copy.");
    }

    const bookId = Number(existingCopy.book_id);
    await recomputeBookInventoryCounts(supabase, bookId);
    return {
      ok: true,
      id: copyId,
      book_id: bookId,
      audit_details: `action=retire_copy book_id=${bookId} copy_id=${copyId} condition=${retireCondition}`,
    };
  }

  if (action === "delete_copy") {
    const parsed = bookCopyDeletePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid delete copy payload.",
        400
      );
    }
    const copyId = id ?? parsed.data.copy_id ?? null;
    if (!copyId) {
      throw new AdminMutationError("Copy ID is required.", 400);
    }

    const { data: existingCopy } = await supabase
      .from("book_copies")
      .select("id, book_id, circulation_status")
      .eq("id", copyId)
      .maybeSingle();
    if (!existingCopy) {
      throw new AdminMutationError("Book copy not found.", 404);
    }
    if (String(existingCopy.circulation_status) === "Borrowed") {
      throw new AdminMutationError(
        "Cannot delete a book copy that is currently borrowed.",
        409
      );
    }

    const { error } = await supabase.from("book_copies").delete().eq("id", copyId);
    if (error) {
      throw mapDatabaseError(error, "Failed to delete book copy.");
    }

    const bookId = Number(existingCopy.book_id);
    await recomputeBookInventoryCounts(supabase, bookId);
    return {
      ok: true,
      deletedId: copyId,
      book_id: bookId,
      audit_details: `action=delete_copy book_id=${bookId} copy_id=${copyId}`,
    };
  }

  const parsed = inventoryUpdatePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AdminMutationError(
      parsed.error.issues[0]?.message || "Invalid inventory payload.",
      400
    );
  }

  const data = parsed.data;
  const payloadBookId = data.book_id ?? 0;
  if (!id && !payloadBookId) {
    throw new AdminMutationError("Inventory ID or Book ID is required.", 400);
  }

  let currentInv: { id: number; book_id: number } | null = null;
  if (id) {
    const { data: invRow } = await supabase
      .from("book_inventory")
      .select("id, book_id")
      .eq("id", id)
      .maybeSingle();
    if (invRow) {
      currentInv = { id: Number(invRow.id), book_id: Number(invRow.book_id) };
    }
  }
  if (!currentInv && payloadBookId) {
    const { data: invRow } = await supabase
      .from("book_inventory")
      .select("id, book_id")
      .eq("book_id", payloadBookId)
      .maybeSingle();
    if (invRow) {
      currentInv = { id: Number(invRow.id), book_id: Number(invRow.book_id) };
    }
  }

  const bookId = Number(currentInv?.book_id ?? payloadBookId ?? 0);
  const invId = currentInv?.id ?? id;

  let volumes = Math.max(0, Number(data.volumes ?? data.total_copies ?? 0) || 0);
  let availableCopies = Math.max(0, Number(data.available_copies ?? 0) || 0);
  let damagedCopies = Math.max(0, Number(data.damaged_copies ?? 0) || 0);
  let destroyedCopies = Math.max(0, Number(data.destroyed_copies ?? 0) || 0);
  let lostCopies = Math.max(0, Number(data.lost_copies ?? 0) || 0);

  if (bookId && Array.isArray(data.copies) && data.copies.length > 0) {
    const synced = await syncBookCopiesInDb(supabase, bookId, data.copies);
    if (synced && data.sync_counts_from_copies !== false) {
      volumes = Math.max(volumes, synced.volumes);
      availableCopies = synced.availableCopies;
      damagedCopies = synced.damagedCopies;
      destroyedCopies = synced.destroyedCopies;
      lostCopies = synced.lostCopies;
    }
  }

  const shelfLocation = String(data.shelf_location ?? "").trim() || null;
  const status = String(data.status ?? "Available").trim() || "Available";
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

  let resolvedBookId = bookId;

  if (currentInv && invId) {
    let { data: updatedInv, error } = await supabase
      .from("book_inventory")
      .update({
        ...baseUpdate,
        destroyed_copies: destroyedCopies,
        condition_status: conditionStatus,
      })
      .eq("id", invId)
      .select("book_id")
      .single();

    if (error) {
      const retry = await supabase
        .from("book_inventory")
        .update(baseUpdate)
        .eq("id", invId)
        .select("book_id")
        .single();
      if (retry.error) throw mapDatabaseError(retry.error, "Failed to update inventory.");
      updatedInv = retry.data;
    }
    if (updatedInv?.book_id) {
      resolvedBookId = Number(updatedInv.book_id);
    }
  } else if (bookId) {
    const ins = await supabase
      .from("book_inventory")
      .insert({
        book_id: bookId,
        ...baseUpdate,
        destroyed_copies: destroyedCopies,
        condition_status: conditionStatus,
      })
      .select("id")
      .single();
    if (ins.error) {
      const retryIns = await supabase
        .from("book_inventory")
        .insert({ book_id: bookId, ...baseUpdate })
        .select("id")
        .single();
      if (retryIns.error) throw mapDatabaseError(retryIns.error, "Failed to create inventory.");
    }
  } else {
    throw new AdminMutationError("Inventory record not found.", 404);
  }

  if (resolvedBookId && data.is_borrowable !== undefined) {
    const rawBorrowable = data.is_borrowable;
    const isBorrowable =
      rawBorrowable !== false &&
      rawBorrowable !== "false" &&
      rawBorrowable !== 0 &&
      rawBorrowable !== "0";
    await supabase
      .from("books")
      .update({ is_borrowable: isBorrowable })
      .eq("id", resolvedBookId);
  }

  return {
    ok: true,
    id: invId ?? resolvedBookId,
    audit_details: `action=update_inventory book_id=${resolvedBookId} volumes=${volumes} available=${availableCopies}`,
  };
}
