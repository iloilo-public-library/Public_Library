import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/config/constants";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { maybeEncryptData, safeDecryptData } from "@/lib/crypto/fernet";
import { isbnMatches, normalizeIsbn } from "@/lib/books/isbn";
import { mapDatabaseError } from "@/lib/errors";
import { AdminMutationError } from "@/repositories/shared";
import {
  buildGeneratedCopies,
  computeConditionSummary,
  syncBookCopiesInDb,
} from "@/repositories/inventory";
import { bookDeletePayloadSchema, bookMutationPayloadSchema } from "@/validators/admin";

export interface BooksQueryOptions {
  page?: number;
  pageSize?: number;
  q?: string;
  isbn?: string;
  available?: boolean;
  damaged?: boolean;
  condition?: string;
  category?: string;
  sort?: string;
  order?: "asc" | "desc";
}

const MAX_PAGE_SIZE = 200;
const DB_FETCH_CAP = 2000;

export async function queryBooks(
  supabase: SupabaseClient,
  options: BooksQueryOptions = {}
) {
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(options.pageSize ?? MAX_PAGE_SIZE))
  );
  const q = (options.q ?? "").trim().toLowerCase();
  const categoryFilter = (options.category ?? "").trim().toLowerCase();
  const conditionFilter = (options.condition ?? "").trim().toLowerCase();
  const sortField = (options.sort ?? "id").trim().toLowerCase();
  const sortAsc = options.order === "asc";

  const [booksRes, invRes, copiesRes] = await Promise.all([
    supabase
      .from("books")
      .select(
        "id, call_number, date_received, class, author, title, isbn, edition, page_count, category, source_of_fund, cost_price, publisher, copy_right, subtitle, published_date, description, language, thumbnail_url, api_source, is_borrowable, created_at, updated_at"
      )
      .order("id", { ascending: false })
      .limit(DB_FETCH_CAP),
    supabase.from("book_inventory").select("*").limit(DB_FETCH_CAP),
    supabase
      .from("book_copies")
      .select(
        "id, book_id, copy_number, accession_number, condition, circulation_status, condition_notes, shelf_location"
      )
      .order("copy_number", { ascending: true })
      .limit(DB_FETCH_CAP * 5),
  ]);
  if (booksRes.error) throw mapDatabaseError(booksRes.error, "Failed to load books.");

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

  let rows = (booksRes.data ?? []).map((b) => {
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
  if (categoryFilter) {
    rows = rows.filter((r) => String(r.category).toLowerCase().includes(categoryFilter));
  }
  if (conditionFilter) {
    rows = rows.filter(
      (r) =>
        String(r.condition_status).toLowerCase().includes(conditionFilter) ||
        r.copies.some((cp) => String(cp.condition).toLowerCase() === conditionFilter)
    );
  }
  if (options.isbn && options.isbn.trim()) {
    rows = rows.filter((r) => isbnMatches(r.isbn, options.isbn));
  }
  if (q) {
    const normalizedQ = normalizeIsbn(q);
    rows = rows.filter((r) => {
      const hay = `${r.title} ${r.author} ${r.isbn} ${r.call_number ?? ""} ${r.catalog_code} ${r.category} ${r.copies
        .map((cp) => String(cp.accession_number ?? ""))
        .join(" ")}`.toLowerCase();
      if (hay.includes(q)) return true;
      if (normalizedQ && normalizeIsbn(r.isbn)?.includes(normalizedQ)) return true;
      return false;
    });
  }

  // Stable sort with id tie-breaker
  rows.sort((a, b) => {
    let cmp = 0;
    if (sortField === "title") {
      cmp = String(a.title).localeCompare(String(b.title));
    } else if (sortField === "author") {
      cmp = String(a.author).localeCompare(String(b.author));
    } else if (sortField === "available" || sortField === "available_copies") {
      cmp = Number(a.available_copies ?? 0) - Number(b.available_copies ?? 0);
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

  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export async function mutateBooks(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  await verifyRepositoryActor(supabase, session.userId, STAFF_ROLES);

  if (action === "delete") {
    const parsedDel = bookDeletePayloadSchema.safeParse(payload);
    if (!parsedDel.success) {
      throw new AdminMutationError(
        parsedDel.error.issues[0]?.message || "Invalid delete payload.",
        400
      );
    }
    if (!id) throw new AdminMutationError("Book ID is required.", 400);

    const { data: existing } = await supabase
      .from("books")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!existing) {
      throw new AdminMutationError("Book not found.", 404);
    }

    // Refuse deleting a book that has currently borrowed copies or active loans
    const [borrowedCopiesRes, activeLoansRes] = await Promise.all([
      supabase
        .from("book_copies")
        .select("id")
        .eq("book_id", id)
        .eq("circulation_status", "Borrowed")
        .limit(1),
      supabase
        .from("library_card_books")
        .select("id")
        .eq("book_id", id)
        .in("loan_status", ["borrowed", "overdue"])
        .limit(1),
    ]);

    if (
      (borrowedCopiesRes.data && borrowedCopiesRes.data.length > 0) ||
      (activeLoansRes.data && activeLoansRes.data.length > 0)
    ) {
      throw new AdminMutationError(
        "Cannot delete this book because one or more copies are currently borrowed.",
        409
      );
    }

    await supabase.from("book_copies").delete().eq("book_id", id);
    await supabase.from("book_inventory").delete().eq("book_id", id);
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) throw mapDatabaseError(error, "Failed to delete book.");
    return { ok: true, deletedId: id, audit_details: `action=delete_book book_id=${id}` };
  }

  const parsed = bookMutationPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AdminMutationError(
      parsed.error.issues[0]?.message || "Title and Author are required.",
      400
    );
  }

  const data = parsed.data;
  const title = data.title;
  const author = data.author;
  const isbn: string | null = data.isbn ?? null;

  // Duplicate ISBN check ONLY when a non-empty ISBN is provided (blank/null ISBNs are allowed)
  if (isbn) {
    const isbnCandidates = Array.from(
      new Set([isbn, maybeEncryptData(isbn)].filter(Boolean))
    );
    let dupQuery = supabase
      .from("books")
      .select("id, isbn")
      .in("isbn", isbnCandidates);
    if (action === "update" && id) {
      dupQuery = dupQuery.neq("id", id);
    }
    const { data: dupRows } = await dupQuery.limit(1);
    let duplicateBookId: number | null =
      dupRows && dupRows.length > 0 ? Number(dupRows[0].id) : null;

    // Also catch hyphenated/formatted legacy ISBN variants
    if (duplicateBookId === null) {
      let scanQuery = supabase
        .from("books")
        .select("id, isbn")
        .not("isbn", "is", null)
        .limit(DB_FETCH_CAP);
      if (action === "update" && id) {
        scanQuery = scanQuery.neq("id", id);
      }
      const { data: existingWithIsbn } = await scanQuery;
      const match = (existingWithIsbn ?? []).find((row) =>
        isbnMatches(safeDecryptData(row.isbn), isbn)
      );
      if (match) {
        duplicateBookId = Number(match.id);
      }
    }

    if (duplicateBookId !== null) {
      throw new AdminMutationError(
        action === "update"
          ? `Another book with this ISBN already exists (Book #${duplicateBookId}).`
          : `A book with this ISBN already exists (Book #${duplicateBookId}).`,
        409
      );
    }
  }

  const callNumber =
    String(data.call_number ?? data.catalog_code ?? "").trim() || null;
  const accessionPrefix = String(data.accession_prefix ?? "").trim() || null;
  const category = String(data.category ?? "").trim();
  const genreClass = String(data.class ?? data.genre ?? "").trim();
  const publisher = String(data.publisher ?? "").trim();

  let volumes = Math.max(
    0,
    Number(data.copies_to_add ?? data.total_copies ?? data.volumes ?? 1) || 0
  );
  let damaged = Math.max(0, Number(data.damaged_copies ?? 0) || 0);
  let destroyed = Math.max(0, Number(data.destroyed_copies ?? 0) || 0);
  let lost = Math.max(0, Number(data.lost_copies ?? 0) || 0);
  let available =
    data.available_copies !== undefined
      ? Math.max(0, Number(data.available_copies) || 0)
      : Math.max(0, volumes - damaged - destroyed - lost);

  const shelfLocation = String(data.shelf_location ?? "").trim() || null;
  const invStatus =
    String(data.inventory_status ?? data.status ?? "Available").trim() || "Available";

  const rawBorrowable = data.is_borrowable;
  const isBorrowable =
    rawBorrowable === undefined
      ? true
      : rawBorrowable !== false &&
        rawBorrowable !== "false" &&
        rawBorrowable !== 0 &&
        rawBorrowable !== "0";

  const bookData: Record<string, unknown> = {
    title,
    author,
    isbn,
    call_number: callNumber,
    class: genreClass || null,
    category: category || null,
    publisher: publisher || null,
    edition: String(data.edition ?? "").trim() || null,
    published_date: String(data.published_date ?? "").trim() || null,
    subtitle: String(data.subtitle ?? "").trim() || null,
    description: String(data.description ?? "").trim() || null,
    language: String(data.language ?? "en").trim().slice(0, 5) || "en",
    thumbnail_url: String(data.thumbnail_url ?? "").trim() || null,
    api_source: String(data.api_source ?? "Manual").trim() || "Manual",
    source_of_fund: String(data.source_of_fund ?? "").trim() || null,
    copy_right: String(data.copy_right ?? "").trim() || null,
    cost_price:
      data.cost_price !== undefined && data.cost_price !== null && data.cost_price !== ""
        ? Number(data.cost_price)
        : null,
    page_count:
      data.page_count !== undefined && data.page_count !== null && data.page_count !== ""
        ? Math.max(0, Math.trunc(Number(data.page_count)))
        : null,
    date_received: String(data.date_received ?? "").trim() || null,
    is_borrowable: isBorrowable,
  };

  if (action === "create") {
    const { data: inserted, error } = await supabase
      .from("books")
      .insert(bookData)
      .select("id")
      .single();
    if (error || !inserted) {
      throw mapDatabaseError(error, "Failed to add book.");
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

    if (Array.isArray(data.copies) && data.copies.length > 0) {
      await syncBookCopiesInDb(supabase, newBookId, data.copies);
    } else {
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

      const { error: copyErr } = await supabase
        .from("book_copies")
        .upsert(generatedCopies, { onConflict: "book_id,copy_number" });
      if (copyErr && copyErr.code === "23505") {
        throw mapDatabaseError(copyErr, "Duplicate accession number.");
      }
    }

    return {
      ok: true,
      id: newBookId,
      book_id: newBookId,
      audit_details: `action=create_book book_id=${newBookId} volumes=${volumes}`,
    };
  }

  if (action === "update") {
    if (!id) throw new AdminMutationError("Book ID is required.", 400);
    const { data: existingBook } = await supabase
      .from("books")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!existingBook) {
      throw new AdminMutationError("Book not found.", 404);
    }

    const { error } = await supabase.from("books").update(bookData).eq("id", id);
    if (error) throw mapDatabaseError(error, "Failed to update book.");

    if (Array.isArray(data.copies) && data.copies.length > 0) {
      const synced = await syncBookCopiesInDb(supabase, id, data.copies);
      if (synced && data.sync_counts_from_copies !== false) {
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
    return {
      ok: true,
      id,
      audit_details: `action=update_book book_id=${id} volumes=${volumes}`,
    };
  }

  throw new AdminMutationError(`Unknown books action: ${action}`, 400);
}
