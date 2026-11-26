import test from "node:test";
import assert from "node:assert/strict";
import { normalizeIsbn, validateOptionalIsbn, isbnMatches } from "../../src/lib/books/isbn.ts";
import { bookMutationPayloadSchema } from "../../src/validators/admin.ts";
import { mutateBooks, queryBooks } from "../../src/repositories/books.ts";
import { mutateLibraryCards } from "../../src/repositories/library-cards.ts";
import { addDaysToIsoDate, getManilaTodayISO } from "../../src/lib/circulation/rules.ts";

const ADMIN_SESSION = {
  userId: 1,
  email: "admin@library.local",
  role: "admin",
  name: "Admin",
};

function createBookIdMockDb(initial = {}) {
  const db = {
    users: structuredClone(
      initial.users ?? [{ id: 1, role: "admin", is_active: true, is_approved: true }]
    ),
    books: structuredClone(initial.books ?? []),
    book_inventory: structuredClone(initial.book_inventory ?? []),
    book_copies: structuredClone(initial.book_copies ?? []),
    library_cards: structuredClone(initial.library_cards ?? []),
    library_card_books: structuredClone(initial.library_card_books ?? []),
    book_returns: structuredClone(initial.book_returns ?? []),
    book_return_items: structuredClone(initial.book_return_items ?? []),
  };
  let nextId = 500;

  function from(table) {
    const state = {
      op: "select",
      filters: [],
      orderBy: null,
      limitVal: null,
      payload: null,
      singleMode: null,
    };

    const applyFilters = (rows) =>
      rows.filter((row) =>
        state.filters.every((f) => {
          const val = row[f.col];
          if (f.type === "eq") return val === f.val;
          if (f.type === "neq") return val !== f.val;
          if (f.type === "in") return Array.isArray(f.val) && f.val.includes(val);
          if (f.type === "not_null") return val !== null && val !== undefined;
          return true;
        })
      );

    const exec = () => {
      const list = db[table] ?? [];
      if (state.op === "select") {
        let out = applyFilters(list);
        if (state.orderBy) {
          const { col, ascending } = state.orderBy;
          out = [...out].sort((a, b) => {
            const av = a[col] ?? 0;
            const bv = b[col] ?? 0;
            return ascending ? (av > bv ? 1 : av < bv ? -1 : 0) : av < bv ? 1 : av > bv ? -1 : 0;
          });
        }
        if (state.limitVal !== null) out = out.slice(0, state.limitVal);
        if (state.singleMode) return { data: out[0] ?? null, error: null };
        return { data: out, error: null };
      }
      if (state.op === "insert" || state.op === "upsert") {
        const rowsToAdd = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = rowsToAdd.map((r) => {
          const row = { id: ++nextId, ...r };
          list.push(row);
          return row;
        });
        return { data: state.singleMode ? inserted[0] : inserted, error: null };
      }
      if (state.op === "update") {
        const targets = applyFilters(list);
        for (const t of targets) Object.assign(t, state.payload);
        return { data: state.singleMode ? (targets[0] ?? null) : targets, error: null };
      }
      if (state.op === "delete") {
        const keep = [];
        const removed = [];
        for (const row of list) {
          if (applyFilters([row]).length > 0) removed.push(row);
          else keep.push(row);
        }
        db[table] = keep;
        return { data: removed, error: null };
      }
      return { data: null, error: null };
    };

    const builder = {
      select() { return builder; },
      insert(p) { state.op = "insert"; state.payload = p; return builder; },
      upsert(p) { state.op = "upsert"; state.payload = p; return builder; },
      update(p) { state.op = "update"; state.payload = p; return builder; },
      delete() { state.op = "delete"; return builder; },
      eq(col, val) { state.filters.push({ type: "eq", col, val }); return builder; },
      neq(col, val) { state.filters.push({ type: "neq", col, val }); return builder; },
      in(col, val) { state.filters.push({ type: "in", col, val }); return builder; },
      not(col, op, val) {
        if (op === "is" && val === null) state.filters.push({ type: "not_null", col });
        return builder;
      },
      order(col, opts = {}) { state.orderBy = { col, ascending: opts.ascending !== false }; return builder; },
      limit(n) { state.limitVal = n; return builder; },
      single() { state.singleMode = "single"; return Promise.resolve(exec()); },
      maybeSingle() { state.singleMode = "maybeSingle"; return Promise.resolve(exec()); },
      then(resolve, reject) { return Promise.resolve(exec()).then(resolve, reject); },
    };
    return builder;
  }

  return { from, db };
}

test("1. Optional ISBN utility normalizes hyphens/spaces and validates ISBN-10/13 checksums", () => {
  assert.equal(normalizeIsbn("   "), null);
  assert.equal(normalizeIsbn("978-0-13-235088-4"), "9780132350884");
  assert.deepEqual(validateOptionalIsbn(""), { ok: true, normalized: null });
  assert.deepEqual(validateOptionalIsbn(undefined), { ok: true, normalized: null });
  assert.deepEqual(validateOptionalIsbn("978-0-13-235088-4"), {
    ok: true,
    normalized: "9780132350884",
  });
  assert.deepEqual(validateOptionalIsbn("0-306-40615-2"), {
    ok: true,
    normalized: "0306406152",
  });
  assert.equal(validateOptionalIsbn("978-0-13-235088-9").ok, false);
  assert.equal(isbnMatches("978-0-13-235088-4", "9780132350884"), true);
});

test("2. Book with no ISBN & two books with blank ISBN both succeed", async () => {
  const supabase = createBookIdMockDb();

  const b1 = await mutateBooks(supabase, ADMIN_SESSION, "create", null, {
    title: "Local Iloilo Folklore Vol. 1",
    author: "Anonymous",
    volumes: 2,
  });
  assert.equal(b1.ok, true);
  assert.ok(b1.id > 0);

  const b2 = await mutateBooks(supabase, ADMIN_SESSION, "create", null, {
    title: "Local Iloilo Folklore Vol. 2",
    author: "Anonymous",
    isbn: "   ",
    volumes: 1,
  });
  assert.equal(b2.ok, true);
  assert.notEqual(b2.id, b1.id);
  assert.equal(supabase.db.books.length, 2);
  assert.equal(supabase.db.books[0].isbn, null);
  assert.equal(supabase.db.books[1].isbn, null);
});

test("3. Duplicate non-empty ISBN returns 409 naming existing book id; bad checksum returns 400", async () => {
  assert.equal(
    bookMutationPayloadSchema.safeParse({
      title: "Bad Checksum",
      author: "Author",
      isbn: "978-0-13-235088-0",
    }).success,
    false
  );

  const supabase = createBookIdMockDb({
    books: [{ id: 42, title: "Clean Code", author: "Robert Martin", isbn: "978-0-13-235088-4" }],
  });

  await assert.rejects(
    () =>
      mutateBooks(supabase, ADMIN_SESSION, "create", null, {
        title: "Clean Code Duplicate",
        author: "Robert Martin",
        isbn: "9780132350884",
      }),
    (err) => err.status === 409 && /Book #42/.test(err.message)
  );
});

test("4. Borrow and return by book_id works for books with no ISBN", async () => {
  const today = getManilaTodayISO();
  const supabase = createBookIdMockDb({
    books: [{ id: 77, title: "Rare Manuscript", author: "Iloilo Archive", isbn: null, is_borrowable: true }],
    book_inventory: [{ id: 1, book_id: 77, volumes: 1, available_copies: 1, borrowed_copies: 0, damaged_copies: 0, lost_copies: 0, status: "Available" }],
    book_copies: [{ id: 701, book_id: 77, copy_number: 1, accession_number: "ARCH-001", condition: "Good", circulation_status: "Available" }],
  });

  const borrowed = await mutateLibraryCards(supabase, ADMIN_SESSION, "create", null, {
    card_type_category: "borrower",
    firstname: "Maria",
    lastname: "Clara",
    book_id: 77,
    date_return: addDaysToIsoDate(today, 7),
  });
  assert.equal(borrowed.ok, true);
  assert.equal(supabase.db.book_copies[0].circulation_status, "Borrowed");
  assert.equal(supabase.db.library_card_books[0].book_id, 77);

  const returned = await mutateLibraryCards(supabase, ADMIN_SESSION, "return_books", borrowed.id, {
    return_date: today,
  });
  assert.equal(returned.ok, true);
  assert.equal(supabase.db.book_copies[0].circulation_status, "Available");
});

test("5. Legacy ISBN lookup and search by ISBN resolve to the same books.id", async () => {
  const today = getManilaTodayISO();
  const supabase = createBookIdMockDb({
    books: [
      { id: 88, title: "Clean Code", author: "Robert Martin", isbn: "9780132350884", is_borrowable: true },
      { id: 89, title: "No ISBN Book", author: "Local Author", isbn: null, is_borrowable: true },
    ],
    book_inventory: [
      { id: 1, book_id: 88, volumes: 1, available_copies: 1, damaged_copies: 0, lost_copies: 0, status: "Available" },
      { id: 2, book_id: 89, volumes: 1, available_copies: 1, damaged_copies: 0, lost_copies: 0, status: "Available" },
    ],
    book_copies: [
      { id: 801, book_id: 88, copy_number: 1, accession_number: "CC-001", condition: "Good", circulation_status: "Available" },
    ],
  });

  // Lookup by hyphenated ISBN resolves to Book #88
  const lookup = await queryBooks(supabase, { isbn: "978-0-13-235088-4" });
  assert.equal(lookup.rows.length, 1);
  assert.equal(lookup.rows[0].id, 88);

  // Search by ISBN with hyphens still finds Book #88
  const search = await queryBooks(supabase, { q: "978-0-13-235088-4" });
  assert.equal(search.rows.length, 1);
  assert.equal(search.rows[0].id, 88);

  // Legacy borrow using isbn resolves to book_id 88 on the server
  const borrowed = await mutateLibraryCards(supabase, ADMIN_SESSION, "create", null, {
    card_type_category: "borrower",
    firstname: "Jose",
    lastname: "Rizal",
    isbn: "978-0-13-235088-4",
    date_return: addDaysToIsoDate(today, 7),
  });
  assert.equal(borrowed.ok, true);
  assert.equal(supabase.db.library_card_books[0].book_id, 88);
});
