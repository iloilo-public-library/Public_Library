import test from "node:test";
import assert from "node:assert/strict";
import {
  bookMutationPayloadSchema,
  bookCopyAddPayloadSchema,
  bookCopyRetirePayloadSchema,
  inventoryUpdatePayloadSchema,
  adminQuerySchema,
} from "../../src/validators/admin.ts";
import { mutateBooks, queryBooks } from "../../src/repositories/books.ts";
import { mutateInventory, queryInventory } from "../../src/repositories/inventory.ts";

const ADMIN_SESSION = {
  userId: 1,
  email: "admin@library.local",
  role: "admin",
  name: "Admin User",
};

function createMockSupabase(initial) {
  const db = {
    users: structuredClone(
      initial.users ?? [{ id: 1, role: "admin", is_active: true, is_approved: true }]
    ),
    books: structuredClone(initial.books ?? []),
    book_inventory: structuredClone(initial.book_inventory ?? []),
    book_copies: structuredClone(initial.book_copies ?? []),
    library_card_books: structuredClone(initial.library_card_books ?? []),
  };
  let nextId = 500;

  function from(table) {
    const state = {
      table,
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
        if (state.singleMode === "single" || state.singleMode === "maybeSingle") {
          return { data: out[0] ?? null, error: null };
        }
        return { data: out, error: null };
      }

      if (state.op === "insert") {
        const rowsToAdd = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = rowsToAdd.map((r) => {
          const row = { id: ++nextId, ...r };
          list.push(row);
          return row;
        });
        return {
          data: state.singleMode ? inserted[0] : inserted,
          error: null,
        };
      }

      if (state.op === "upsert") {
        const rowsToAdd = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = rowsToAdd.map((r) => {
          const row = { id: ++nextId, ...r };
          list.push(row);
          return row;
        });
        return { data: inserted, error: null };
      }

      if (state.op === "update") {
        const targets = applyFilters(list);
        for (const t of targets) {
          Object.assign(t, state.payload);
        }
        return {
          data: state.singleMode ? (targets[0] ?? null) : targets,
          error: null,
        };
      }

      if (state.op === "delete") {
        const keep = [];
        const removed = [];
        for (const row of list) {
          const matched = applyFilters([row]).length > 0;
          if (matched) removed.push(row);
          else keep.push(row);
        }
        db[table] = keep;
        return { data: removed, error: null };
      }

      return { data: null, error: null };
    };

    const builder = {
      select() {
        return builder;
      },
      insert(p) {
        state.op = "insert";
        state.payload = p;
        return builder;
      },
      upsert(p) {
        state.op = "upsert";
        state.payload = p;
        return builder;
      },
      update(p) {
        state.op = "update";
        state.payload = p;
        return builder;
      },
      delete() {
        state.op = "delete";
        return builder;
      },
      eq(col, val) {
        state.filters.push({ type: "eq", col, val });
        return builder;
      },
      neq(col, val) {
        state.filters.push({ type: "neq", col, val });
        return builder;
      },
      in(col, val) {
        state.filters.push({ type: "in", col, val });
        return builder;
      },
      order(col, opts = {}) {
        state.orderBy = { col, ascending: opts.ascending !== false };
        return builder;
      },
      limit(n) {
        state.limitVal = n;
        return builder;
      },
      single() {
        state.singleMode = "single";
        return Promise.resolve(exec());
      },
      maybeSingle() {
        state.singleMode = "maybeSingle";
        return Promise.resolve(exec());
      },
      then(resolve, reject) {
        return Promise.resolve(exec()).then(resolve, reject);
      },
    };
    return builder;
  }

  return { from, db };
}

test("Strict validators reject unknown fields and invalid copy conditions", () => {
  assert.equal(
    bookMutationPayloadSchema.safeParse({
      title: "Test Book",
      author: "Author",
      isbn: "978-0-00-000001-1",
      unexpected_field: true,
    }).success,
    false
  );

  assert.equal(
    inventoryUpdatePayloadSchema.safeParse({
      book_id: 1,
      volumes: 3,
      bogus: "nope",
    }).success,
    false
  );

  assert.equal(
    bookCopyAddPayloadSchema.safeParse({
      book_id: 1,
      condition: "Waterlogged",
    }).success,
    false
  );

  assert.equal(
    bookCopyRetirePayloadSchema.safeParse({
      copy_id: 1,
      condition: "Good",
    }).success,
    false
  );

  assert.equal(
    adminQuerySchema.safeParse({
      resource: "books",
      page: 1,
      pageSize: 500,
    }).success,
    false
  );
});

test("Books: duplicate ISBN is rejected with 409", async () => {
  const supabase = createMockSupabase({
    books: [{ id: 10, title: "Existing", author: "A", isbn: "9780132350884" }],
  });

  await assert.rejects(
    () =>
      mutateBooks(supabase, ADMIN_SESSION, "create", null, {
        title: "New Book",
        author: "B",
        isbn: "978-0-13-235088-4",
      }),
    (err) => err.status === 409 && /ISBN/i.test(err.message) && /#10/.test(err.message)
  );
});

test("Books: deleting a book with borrowed copies is refused with 409", async () => {
  const supabase = createMockSupabase({
    books: [{ id: 10, title: "Borrowed Book", author: "A", isbn: "978-2222222222" }],
    book_copies: [
      { id: 100, book_id: 10, copy_number: 1, accession_number: "ACC-1", circulation_status: "Borrowed", condition: "Good" },
    ],
  });

  await assert.rejects(
    () => mutateBooks(supabase, ADMIN_SESSION, "delete", 10, {}),
    (err) => err.status === 409 && /borrowed/i.test(err.message)
  );
});

test("Inventory copies: borrowed copy cannot be deleted or retired, duplicate accession rejected", async () => {
  const supabase = createMockSupabase({
    books: [{ id: 10, title: "Book", author: "A", isbn: "978-3333333333", call_number: "QA76" }],
    book_inventory: [{ id: 1, book_id: 10, volumes: 2, available_copies: 1, borrowed_copies: 1, damaged_copies: 0, lost_copies: 0 }],
    book_copies: [
      { id: 100, book_id: 10, copy_number: 1, accession_number: "QA76-C001", circulation_status: "Borrowed", condition: "Good" },
      { id: 101, book_id: 10, copy_number: 2, accession_number: "QA76-C002", circulation_status: "Available", condition: "Good" },
    ],
  });

  // Cannot delete borrowed copy
  await assert.rejects(
    () => mutateInventory(supabase, ADMIN_SESSION, "delete_copy", 100, {}),
    (err) => err.status === 409 && /borrowed/i.test(err.message)
  );

  // Cannot retire borrowed copy
  await assert.rejects(
    () => mutateInventory(supabase, ADMIN_SESSION, "retire_copy", 100, { condition: "Destroyed" }),
    (err) => err.status === 409 && /borrowed/i.test(err.message)
  );

  // Reject duplicate accession number on add_copy
  await assert.rejects(
    () =>
      mutateInventory(supabase, ADMIN_SESSION, "add_copy", null, {
        book_id: 10,
        accession_number: "QA76-C002",
        condition: "Good",
      }),
    (err) => err.status === 409 && /accession/i.test(err.message)
  );

  // Available copy can be retired cleanly
  const retired = await mutateInventory(supabase, ADMIN_SESSION, "retire_copy", 101, {
    condition: "Damaged",
    reason: "Torn pages",
  });
  assert.equal(retired.ok, true);
  assert.equal(supabase.db.book_copies.find((c) => c.id === 101).circulation_status, "Unusable");
});

test("Books & Inventory list endpoints support bounded pagination, search, and filters", async () => {
  const supabase = createMockSupabase({
    books: [
      { id: 1, title: "Alpha Algorithms", author: "Knuth", isbn: "111", call_number: "QA1", category: "CS", is_borrowable: true },
      { id: 2, title: "Beta Biology", author: "Darwin", isbn: "222", call_number: "QH1", category: "Science", is_borrowable: true },
      { id: 3, title: "Gamma Geometry", author: "Euclid", isbn: "333", call_number: "QA2", category: "Math", is_borrowable: true },
    ],
    book_inventory: [
      { id: 11, book_id: 1, volumes: 3, available_copies: 2, damaged_copies: 1, lost_copies: 0, status: "Available" },
      { id: 12, book_id: 2, volumes: 1, available_copies: 0, damaged_copies: 0, lost_copies: 0, status: "Out of Stock" },
      { id: 13, book_id: 3, volumes: 2, available_copies: 2, damaged_copies: 0, lost_copies: 0, status: "Available" },
    ],
    book_copies: [],
  });

  const avail = await queryBooks(supabase, { actorId: 1, available: true, page: 1, pageSize: 1 });
  assert.equal(avail.total, 2);
  assert.equal(avail.rows.length, 1);
  assert.equal(avail.totalPages, 2);

  const damagedInv = await queryInventory(supabase, { actorId: 1, damaged: true });
  assert.equal(damagedInv.total, 1);
  assert.equal(damagedInv.rows[0].book_id, 1);

  const searchRes = await queryInventory(supabase, { actorId: 1, q: "darwin" });
  assert.equal(searchRes.total, 1);
  assert.equal(searchRes.rows[0].book_id, 2);
});
