import test from "node:test";
import assert from "node:assert/strict";
import {
  CIRCULATION_RULES,
  addDaysToIsoDate,
  computeOverdueDays,
  escapeCsvCell,
  getManilaTodayISO,
} from "../../src/lib/circulation/rules.ts";
import { adminQuerySchema } from "../../src/validators/admin.ts";
import {
  claimCopyAtomically,
  mutateLibraryCards,
  queryLibraryCards,
} from "../../src/repositories/library-cards.ts";
import { queryReturns } from "../../src/repositories/returns.ts";

const ADMIN_SESSION = {
  userId: 1,
  email: "admin@library.local",
  role: "admin",
  name: "Admin",
};

const LIBRARIAN_SESSION = {
  userId: 2,
  email: "librarian@library.local",
  role: "librarian",
  name: "Librarian",
};

function createCirculationMockDb(initial = {}) {
  const db = {
    users: structuredClone(
      initial.users ?? [
        { id: 1, role: "admin", is_active: true, is_approved: true, firstname: "Admin", lastname: "One" },
        { id: 2, role: "librarian", is_active: true, is_approved: true, firstname: "Lib", lastname: "One" },
        { id: 50, role: "user", is_active: true, is_approved: true, firstname: "Member", lastname: "A" },
      ]
    ),
    books: structuredClone(
      initial.books ?? [
        { id: 10, title: "Clean Code", author: "Robert Martin", isbn: "978-0132350884", cost_price: 750, is_borrowable: true },
        { id: 11, title: "Domain-Driven Design", author: "Eric Evans", isbn: "978-0321125217", cost_price: 800, is_borrowable: true },
      ]
    ),
    book_inventory: structuredClone(
      initial.book_inventory ?? [
        { id: 1, book_id: 10, volumes: 5, available_copies: 5, borrowed_copies: 0, damaged_copies: 0, lost_copies: 0, status: "Available" },
        { id: 2, book_id: 11, volumes: 5, available_copies: 5, borrowed_copies: 0, damaged_copies: 0, lost_copies: 0, status: "Available" },
      ]
    ),
    book_copies: structuredClone(
      initial.book_copies ?? [
        { id: 100, book_id: 10, copy_number: 1, accession_number: "ACC-100", condition: "Good", circulation_status: "Available" },
        { id: 101, book_id: 10, copy_number: 2, accession_number: "ACC-101", condition: "Good", circulation_status: "Available" },
        { id: 200, book_id: 11, copy_number: 1, accession_number: "ACC-200", condition: "Good", circulation_status: "Available" },
      ]
    ),
    library_cards: structuredClone(initial.library_cards ?? []),
    library_card_books: structuredClone(initial.library_card_books ?? []),
    book_returns: structuredClone(initial.book_returns ?? []),
    book_return_items: structuredClone(initial.book_return_items ?? []),
    account_requests: structuredClone(initial.account_requests ?? []),
  };

  let nextId = 5000;
  const rpcCalls = [];

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
          return true;
        })
      );

    const exec = () => {
      if (initial.forceErrorTable && initial.forceErrorTable === table && state.op === "update") {
        return { data: null, error: { code: "23514", message: "Forced constraint error" } };
      }
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
      if (state.op === "insert") {
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
        for (const t of targets) {
          Object.assign(t, state.payload);
        }
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
      select() {
        return builder;
      },
      insert(p) {
        state.op = "insert";
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

  return {
    from,
    db,
    rpcCalls,
    rpc: initial.rpcImpl
      ? async (name, args) => {
          rpcCalls.push({ name, args });
          return initial.rpcImpl(name, args, db);
        }
      : undefined,
  };
}

test("1a. Server-owned dates: create/return/renew ignore client date_issued, return_date, and date_return", async () => {
  const today = getManilaTodayISO();
  const expectedDue = addDaysToIsoDate(today, CIRCULATION_RULES.DEFAULT_LOAN_DAYS);
  const pastIssued = addDaysToIsoDate(today, -30);
  const clientDue = addDaysToIsoDate(today, 2);

  const supabase = createCirculationMockDb();

  const created = await mutateLibraryCards(supabase, LIBRARIAN_SESSION, "create", null, {
    card_type_category: "member",
    user_id: 50,
    firstname: "Member",
    lastname: "A",
    book_id: 10,
    date_issued: pastIssued,
    date_return: clientDue,
  });

  assert.equal(created.ok, true);
  assert.equal(supabase.db.library_cards[0].date_issued, today);
  assert.equal(supabase.db.library_cards[0].date_return, expectedDue);

  // Renew ignores client date_return and extends strictly by RENEWAL_EXTENSION_DAYS
  const customRenewDue = addDaysToIsoDate(today, 1);
  const renewed = await mutateLibraryCards(supabase, LIBRARIAN_SESSION, "renew", created.id, {
    date_return: customRenewDue,
  });
  assert.equal(
    renewed.date_return,
    addDaysToIsoDate(expectedDue, CIRCULATION_RULES.RENEWAL_EXTENSION_DAYS)
  );

  // Return ignores client backdated return_date without admin backdate_reason
  const fourDaysAgo = addDaysToIsoDate(today, -4);
  const expectedDays = computeOverdueDays(fourDaysAgo, today);
  supabase.db.library_cards[0].date_return = fourDaysAgo;
  const returned = await mutateLibraryCards(supabase, LIBRARIAN_SESSION, "return_books", created.id, {
    return_date: addDaysToIsoDate(today, -10),
  });
  assert.equal(returned.overdue_days, expectedDays);
  assert.equal(returned.fine_amount, expectedDays * CIRCULATION_RULES.DAILY_OVERDUE_FINE_PHP);
  assert.equal(supabase.db.book_returns[0].return_date, today);
});

test("1b. Backdating requires admin role + valid backdate_reason and logs audit_details", async () => {
  const today = getManilaTodayISO();
  const pastIssued = addDaysToIsoDate(today, -3);
  const supabase = createCirculationMockDb();

  // Librarian cannot backdate
  await assert.rejects(
    () =>
      mutateLibraryCards(supabase, LIBRARIAN_SESSION, "create", null, {
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        book_id: 10,
        date_issued: pastIssued,
        backdate_reason: "Entered from offline paper log",
      }),
    (err) => err.status === 403
  );

  // Admin can backdate with a reason and it appears in audit_details
  const created = await mutateLibraryCards(supabase, ADMIN_SESSION, "create", null, {
    card_type_category: "member",
    user_id: 50,
    firstname: "Member",
    lastname: "A",
    book_id: 10,
    date_issued: pastIssued,
    backdate_reason: "Entered from offline paper log",
  });
  assert.equal(supabase.db.library_cards[0].date_issued, pastIssued);
  assert.equal(
    created.date_return,
    addDaysToIsoDate(pastIssued, CIRCULATION_RULES.DEFAULT_LOAN_DAYS)
  );
  assert.match(created.audit_details, /backdated=true/);
});

test("2. Card expiry handles locale strings and checks existing cards even when client sends valid_until", async () => {
  const today = getManilaTodayISO();
  const futureIso = addDaysToIsoDate(today, 180);

  // Locale date on existing card must be detected as expired even if client submits valid_until in future
  const dbLocaleExpired = createCirculationMockDb({
    library_cards: [{ id: 1, user_id: 50, valid_until: "January 1, 2020" }],
  });
  await assert.rejects(
    () =>
      mutateLibraryCards(dbLocaleExpired, ADMIN_SESSION, "create", null, {
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        book_id: 10,
        valid_until: futureIso,
      }),
    (err) => err.status === 400 && /expired/i.test(err.message)
  );

  // LGU "Until Retirement" is NOT treated as expired
  const dbLgu = createCirculationMockDb({
    library_cards: [{ id: 2, user_id: 50, valid_until: "Until Retirement" }],
  });
  const okLgu = await mutateLibraryCards(dbLgu, ADMIN_SESSION, "create", null, {
    card_type_category: "member",
    user_id: 50,
    firstname: "Member",
    lastname: "A",
    book_id: 10,
    valid_until: "Until Retirement",
  });
  assert.equal(okLgu.ok, true);
});

test("3. Limits: member requires user_id, walk-in borrower enforces book cap, and atomic RPC enforces limit", async () => {
  const supabase = createCirculationMockDb();

  // Member card without user_id must be rejected 400
  await assert.rejects(
    () =>
      mutateLibraryCards(supabase, ADMIN_SESSION, "create", null, {
        card_type_category: "member",
        firstname: "No",
        lastname: "UserId",
        book_id: 10,
      }),
    (err) => err.status === 400 && /user_id|member/i.test(err.message)
  );

  // Walk-in borrower requesting > MAX_ACTIVE_BORROWS (3 > 2) must be rejected 409
  const threeBooks = [10, 10, 11];
  await assert.rejects(
    () =>
      mutateLibraryCards(supabase, ADMIN_SESSION, "create", null, {
        card_type_category: "borrower",
        firstname: "Walk",
        lastname: "In",
        book_ids: threeBooks,
      }),
    (err) => err.status === 409 && /limit|max/i.test(err.message)
  );

  // Atomic borrow_card_books_atomic RPC invoked when present & BORROW_LIMIT_EXCEEDED -> 409
  const dbRpcLimit = createCirculationMockDb({
    rpcImpl: async (name) => {
      if (name === "borrow_card_books_atomic") {
        return { data: null, error: { code: "P0001", message: "BORROW_LIMIT_EXCEEDED" } };
      }
      return { data: null, error: { code: "42883", message: "function does not exist" } };
    },
  });
  await assert.rejects(
    () =>
      mutateLibraryCards(dbRpcLimit, ADMIN_SESSION, "create", null, {
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        book_id: 10,
      }),
    (err) => err.status === 409
  );
  assert.ok(dbRpcLimit.rpcCalls.some((c) => c.name === "borrow_card_books_atomic"));
});

test("4. RPC: AppError is rethrown, rollback restores book_inventory, and Damaged/Poor copies are not claimable", async () => {
  // 4a. AppError from mapDatabaseError (e.g. unique violation 23505) must NOT be swallowed by claimCopyAtomically
  const dbWithRpcConstraintErr = createCirculationMockDb({
    rpcImpl: async () => ({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    }),
  });
  await assert.rejects(
    () =>
      claimCopyAtomically(dbWithRpcConstraintErr, {
        cardId: 1,
        bookId: 10,
        copyId: 100,
        bookTitle: "Clean Code",
        bookAuthor: "Robert Martin",
        bookIsbn: "123",
      }),
    (err) => err.status === 409
  );

  // 4b. Multi-book rollback restores book_inventory.available_copies for legacy book without book_copies
  const dbRollback = createCirculationMockDb({
    books: [
      { id: 10, title: "Legacy Book", author: "Auth", isbn: "111", is_borrowable: true },
      { id: 11, title: "Unavailable Copy Book", author: "Auth", isbn: "222", is_borrowable: true },
    ],
    book_inventory: [
      { id: 1, book_id: 10, volumes: 4, available_copies: 4, borrowed_copies: 0, damaged_copies: 0, lost_copies: 0 },
      { id: 2, book_id: 11, volumes: 1, available_copies: 0, borrowed_copies: 1, damaged_copies: 0, lost_copies: 0 },
    ],
    book_copies: [
      { id: 200, book_id: 11, copy_number: 1, condition: "Good", circulation_status: "Borrowed" },
    ],
  });
  await assert.rejects(
    () =>
      mutateLibraryCards(dbRollback, ADMIN_SESSION, "create", null, {
        card_type_category: "borrower",
        firstname: "Roll",
        lastname: "Back",
        book_ids: [{ book_id: 10, qty: 2 }, { book_id: 11, qty: 1 }],
      }),
    (err) => err.status === 409
  );
  assert.equal(dbRollback.db.book_inventory[0].available_copies, 4);

  // 4c. Damaged copy with circulation_status=Available cannot be claimed
  const dbDamaged = createCirculationMockDb({
    book_copies: [
      { id: 100, book_id: 10, copy_number: 1, condition: "Damaged", circulation_status: "Available" },
    ],
  });
  await assert.rejects(
    () =>
      mutateLibraryCards(dbDamaged, ADMIN_SESSION, "create", null, {
        card_type_category: "borrower",
        firstname: "Bad",
        lastname: "Condition",
        book_id: 10,
      }),
    (err) => err.status === 409
  );
});

test("5. Update action cannot bypass rules, rejects returned cards, validates dates, and swaps copies safely", async () => {
  const today = getManilaTodayISO();
  const db = createCirculationMockDb({
    book_copies: [
      { id: 100, book_id: 10, copy_number: 1, condition: "Good", circulation_status: "Borrowed" },
      { id: 200, book_id: 11, copy_number: 1, condition: "Damaged", circulation_status: "Unusable" },
    ],
    library_cards: [
      {
        id: 700,
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        date_issued: today,
        date_return: addDaysToIsoDate(today, 7),
        renewal1_checked: false,
        renewal2_checked: false,
      },
      {
        id: 701,
        card_type_category: "member",
        user_id: 50,
        firstname: "Returned",
        lastname: "Card",
        date_issued: today,
        date_return: addDaysToIsoDate(today, 7),
      },
    ],
    library_card_books: [
      { id: 800, card_id: 700, book_id: 10, copy_id: 100, book_title: "Clean Code", quantity: 1, loan_status: "borrowed" },
      { id: 801, card_id: 701, book_id: 11, copy_id: 200, book_title: "Domain-Driven Design", quantity: 1, loan_status: "returned" },
    ],
  });

  // Returned card update blocked (409)
  await assert.rejects(
    () => mutateLibraryCards(db, ADMIN_SESSION, "update", 701, { firstname: "Hack" }),
    (err) => err.status === 409
  );

  // Toggling renewal flag via update blocked (400)
  await assert.rejects(
    () => mutateLibraryCards(db, ADMIN_SESSION, "update", 700, { renewal1_checked: true }),
    (err) => err.status === 400
  );

  // Past due date via update blocked (400)
  await assert.rejects(
    () => mutateLibraryCards(db, ADMIN_SESSION, "update", 700, { date_return: addDaysToIsoDate(today, -1) }),
    (err) => err.status === 400
  );

  // Failed swap (book 11 has no Good/Fair Available copies) must keep old loan 800 & copy 100 Borrowed
  await assert.rejects(
    () => mutateLibraryCards(db, ADMIN_SESSION, "update", 700, { book_ids: [11] }),
    (err) => err.status === 409
  );
  assert.equal(db.db.book_copies[0].circulation_status, "Borrowed");
  assert.equal(db.db.library_card_books.filter((b) => b.card_id === 700).length, 1);
  assert.equal(db.db.book_copies[1].circulation_status, "Unusable");
});

test("6. Returns reject already-returned, empty, or over-qty items, and partial return does not mark card returned", async () => {
  const today = getManilaTodayISO();
  const db = createCirculationMockDb({
    book_copies: [
      { id: 100, book_id: 10, copy_number: 1, condition: "Good", circulation_status: "Borrowed" },
      { id: 200, book_id: 11, copy_number: 1, condition: "Good", circulation_status: "Borrowed" },
    ],
    library_cards: [
      {
        id: 710,
        card_type_category: "member",
        user_id: 50,
        firstname: "Partial",
        lastname: "Patron",
        date_issued: today,
        date_return: addDaysToIsoDate(today, 7),
      },
    ],
    library_card_books: [
      { id: 810, card_id: 710, book_id: 10, copy_id: 100, book_title: "Book 1", quantity: 1, loan_status: "borrowed" },
      { id: 811, card_id: 710, book_id: 11, copy_id: 200, book_title: "Book 2", quantity: 1, loan_status: "borrowed" },
    ],
  });

  // Empty items rejected 400
  await assert.rejects(
    () => mutateLibraryCards(db, ADMIN_SESSION, "return_books", 710, { items: [] }),
    (err) => err.status === 400
  );

  // Over-quantity rejected 400
  await assert.rejects(
    () =>
      mutateLibraryCards(db, ADMIN_SESSION, "return_books", 710, {
        items: [{ card_book_id: 810, qty_returned: 3 }],
      }),
    (err) => err.status === 400
  );

  // Partial return of item 810 leaves item 811 active -> card must still be NOT returned
  await mutateLibraryCards(db, ADMIN_SESSION, "return_books", 710, {
    items: [{ card_book_id: 810, qty_returned: 1 }],
  });
  const cardListMid = await queryLibraryCards(db, { id: 710, actorId: 1, sessionRole: "admin" });
  assert.equal(cardListMid.card.is_returned, false);
  assert.equal(cardListMid.card.status, "active");

  // Re-returning item 810 rejected 409
  await assert.rejects(
    () =>
      mutateLibraryCards(db, ADMIN_SESSION, "return_books", 710, {
        items: [{ card_book_id: 810, qty_returned: 1 }],
      }),
    (err) => err.status === 409
  );

  // Returning remaining item 811 marks whole card returned
  await mutateLibraryCards(db, ADMIN_SESSION, "return_books", 710, {
    items: [{ card_book_id: 811, qty_returned: 1 }],
  });
  const cardListEnd = await queryLibraryCards(db, { id: 710, actorId: 1, sessionRole: "admin" });
  assert.equal(cardListEnd.card.is_returned, true);
  assert.equal(cardListEnd.card.status, "returned");
});

test("7. Mark lost/damaged ignores client copy_id, preserves no-copy inventory, and queryLibraryCards reflects lost status", async () => {
  const today = getManilaTodayISO();
  const db = createCirculationMockDb({
    books: [{ id: 10, title: "No Copies Book", author: "Auth", cost_price: 600, is_borrowable: true }],
    book_inventory: [
      { id: 1, book_id: 10, volumes: 5, available_copies: 4, borrowed_copies: 1, damaged_copies: 0, lost_copies: 0 },
    ],
    book_copies: [
      { id: 999, book_id: 11, copy_number: 1, condition: "Good", circulation_status: "Available" },
    ],
    library_cards: [
      { id: 720, card_type_category: "member", user_id: 50, firstname: "Lost", lastname: "Book", date_issued: today, date_return: addDaysToIsoDate(today, 7) },
    ],
    library_card_books: [
      { id: 820, card_id: 720, book_id: 10, copy_id: null, book_title: "No Copies Book", quantity: 1, loan_status: "borrowed" },
    ],
  });

  // Client supplies unrelated copy_id 999: must NOT mutate copy 999
  await assert.rejects(
    () =>
      mutateLibraryCards(db, ADMIN_SESSION, "mark_lost", 720, {
        card_book_id: 820,
        copy_id: 999,
        reason: "Lost in transit",
      }),
    (err) => err.status === 400
  );
  assert.equal(db.db.book_copies[0].condition, "Good");
  assert.equal(db.db.book_copies[0].circulation_status, "Available");

  // Legitimate mark_lost on no-copy book must NOT zero volumes or available_copies
  const lost = await mutateLibraryCards(db, ADMIN_SESSION, "mark_lost", 720, {
    card_book_id: 820,
    reason: "Lost in transit",
    affidavit_reference: "AFF-2026-720",
  });
  assert.equal(lost.ok, true);
  assert.equal(lost.loan_status, "replacement_pending");
  assert.equal(db.db.book_inventory[0].volumes, 5);
  assert.equal(db.db.book_inventory[0].available_copies, 4);
  assert.equal(db.db.book_inventory[0].lost_copies, 1);

  const view = await queryLibraryCards(db, { id: 720, actorId: 1, sessionRole: "admin" });
  assert.equal(view.card.status, "replacement_pending");
  assert.equal(view.card.has_replacement_pending, true);
  assert.equal(view.card.is_returned, false);
});

test("8. CSV allows up to 5000 rows on server and neutralizes formula injection with leading tab/space", async () => {
  assert.equal(escapeCsvCell("\t=1+1"), "'\t=1+1");
  assert.equal(escapeCsvCell(" =CMD('calc')"), "' =CMD('calc')");
  assert.equal(escapeCsvCell("\r+2+3"), "\"'\r+2+3\"");

  const csvQueryValid = adminQuerySchema.safeParse({
    resource: "library_cards",
    format: "csv",
    limit: "5000",
  });
  assert.equal(csvQueryValid.success, true);

  const jsonQueryTooLarge = adminQuerySchema.safeParse({
    resource: "library_cards",
    format: "json",
    limit: "500",
  });
  assert.equal(jsonQueryTooLarge.success, false);

  const manyCards = Array.from({ length: 250 }, (_, i) => ({
    id: i + 1,
    card_type_category: "borrower",
    firstname: `User${i}`,
    lastname: "Test",
    date_issued: "2026-11-01",
    date_return: "2026-11-08",
  }));
  const manyReturns = Array.from({ length: 250 }, (_, i) => ({
    id: i + 1,
    card_id: i + 1,
    return_date: "2026-11-08",
  }));
  const manyReturnItems = Array.from({ length: 250 }, (_, i) => ({
    id: i + 1,
    return_id: i + 1,
    book_title: `Book ${i}`,
    qty_returned: 1,
  }));

  const db = createCirculationMockDb({
    library_cards: manyCards,
    book_returns: manyReturns,
    book_return_items: manyReturnItems,
  });

  const csvCards = await queryLibraryCards(db, {
    actorId: 1,
    sessionRole: "admin",
    format: "csv",
    pageSize: 5000,
  });
  assert.equal(csvCards.rows.length, 250);

  const csvReturns = await queryReturns(db, {
    actorId: 1,
    sessionRole: "admin",
    format: "csv",
    pageSize: 5000,
  });
  assert.equal(csvReturns.rows.length, 250);
});
