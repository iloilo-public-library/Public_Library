import test from "node:test";
import assert from "node:assert/strict";
import {
  CIRCULATION_RULES,
  addDaysToIsoDate,
  buildBorrowHistoryCsv,
  computeOverdueDays,
  computeOverdueFine,
  getManilaTodayISO,
  validateAndResolveDueDate,
} from "../../src/lib/circulation/rules.ts";
import {
  libraryCardCreateSchema,
  libraryCardMarkIncidentSchema,
  libraryCardReturnSchema,
  libraryCardWaiveFineSchema,
} from "../../src/validators/admin.ts";
import {
  claimCopyAtomically,
  mutateLibraryCards,
  queryLibraryCards,
} from "../../src/repositories/library-cards.ts";
import { getMemberBorrowedBooks, requestMemberCardRenewal } from "../../src/repositories/member.ts";

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

const MEMBER_A_SESSION = {
  userId: 50,
  email: "membera@library.local",
  role: "user",
  name: "Member A",
};

function createCirculationMockDb(initial = {}) {
  const db = {
    users: structuredClone(
      initial.users ?? [
        { id: 1, role: "admin", is_active: true, is_approved: true, firstname: "Admin", lastname: "One" },
        { id: 2, role: "librarian", is_active: true, is_approved: true, firstname: "Lib", lastname: "One" },
        { id: 50, role: "user", is_active: true, is_approved: true, firstname: "Member", lastname: "A" },
        { id: 51, role: "user", is_active: true, is_approved: true, firstname: "Member", lastname: "B" },
      ]
    ),
    books: structuredClone(
      initial.books ?? [
        { id: 10, title: "Clean Code", author: "Robert Martin", isbn: "978-0132350884", cost_price: 750, is_borrowable: true },
      ]
    ),
    book_inventory: structuredClone(
      initial.book_inventory ?? [
        { id: 1, book_id: 10, volumes: 1, available_copies: 1, borrowed_copies: 0, damaged_copies: 0, lost_copies: 0, status: "Available" },
      ]
    ),
    book_copies: structuredClone(
      initial.book_copies ?? [
        { id: 100, book_id: 10, copy_number: 1, accession_number: "ICPL-0010-C001", condition: "Good", circulation_status: "Available" },
      ]
    ),
    library_cards: structuredClone(initial.library_cards ?? []),
    library_card_books: structuredClone(initial.library_card_books ?? []),
    book_returns: structuredClone(initial.book_returns ?? []),
    book_return_items: structuredClone(initial.book_return_items ?? []),
    account_requests: structuredClone(initial.account_requests ?? []),
  };

  let nextId = 1000;

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

  return { from, db };
}

test("1. Atomic borrow race: two simultaneous requests for the same copy -> exactly one succeeds", async () => {
  const supabase = createCirculationMockDb();

  const [r1, r2] = await Promise.allSettled([
    claimCopyAtomically(supabase, {
      cardId: 1,
      bookId: 10,
      copyId: 100,
      bookTitle: "Clean Code",
      bookAuthor: "Robert Martin",
      bookIsbn: "978-0132350884",
    }),
    claimCopyAtomically(supabase, {
      cardId: 2,
      bookId: 10,
      copyId: 100,
      bookTitle: "Clean Code",
      bookAuthor: "Robert Martin",
      bookIsbn: "978-0132350884",
    }),
  ]);

  const fulfilled = [r1, r2].filter((r) => r.status === "fulfilled");
  const rejected = [r1, r2].filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.status, 409);
  assert.equal(supabase.db.book_copies[0].circulation_status, "Borrowed");
  assert.equal(supabase.db.library_card_books.length, 1);
});

test("2. Server-side due date, overdue days, and fine calculation in Asia/Manila", () => {
  const today = getManilaTodayISO();
  const past = addDaysToIsoDate(today, -1);
  const tooFar = addDaysToIsoDate(today, CIRCULATION_RULES.MAX_LOAN_DAYS + 5);
  const validDue = addDaysToIsoDate(today, 7);

  assert.equal(validateAndResolveDueDate(past, today, today).ok, false);
  assert.equal(validateAndResolveDueDate(tooFar, today, today).ok, false);
  assert.deepEqual(validateAndResolveDueDate(validDue, today, today), {
    ok: true,
    dateReturn: validDue,
  });

  const overdueDays = computeOverdueDays("2026-05-01", "2026-05-05");
  assert.equal(overdueDays, 4);
  assert.equal(computeOverdueFine(overdueDays), 4 * CIRCULATION_RULES.DAILY_OVERDUE_FINE_PHP);
});

test("3. Strict circulation schemas reject unknown fields & client-supplied fine_amount", () => {
  assert.equal(
    libraryCardReturnSchema.safeParse({
      return_date: "2026-05-10",
      fine_amount: 0,
    }).success,
    false
  );
  assert.equal(
    libraryCardCreateSchema.safeParse({
      firstname: "Juan",
      lastname: "Dela Cruz",
      extra: "bad",
    }).success,
    false
  );
  assert.equal(
    libraryCardMarkIncidentSchema.safeParse({ reason: "x" }).success,
    false
  );
  assert.equal(
    libraryCardWaiveFineSchema.safeParse({ reason: "" }).success,
    false
  );
});

test("4. Borrow eligibility enforces expired card, borrow limit, and unpaid fines", async () => {
  const today = getManilaTodayISO();
  const yesterday = addDaysToIsoDate(today, -1);
  const nextWeek = addDaysToIsoDate(today, 7);

  // Expired card
  const dbExpired = createCirculationMockDb({
    library_cards: [{ id: 201, user_id: 50, valid_until: yesterday }],
  });
  await assert.rejects(
    () =>
      mutateLibraryCards(dbExpired, ADMIN_SESSION, "create", null, {
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        book_id: 10,
        date_return: nextWeek,
      }),
    (err) => err.status === 400 && /expired/i.test(err.message)
  );

  // Unpaid fine blocks borrow
  const dbFine = createCirculationMockDb({
    library_cards: [{ id: 202, user_id: 50, valid_until: addDaysToIsoDate(today, 30) }],
    book_returns: [{ id: 301, card_id: 202, fine_amount: 25, fine_paid: false, fine_waived: false }],
  });
  await assert.rejects(
    () =>
      mutateLibraryCards(dbFine, ADMIN_SESSION, "create", null, {
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        book_id: 10,
        date_return: nextWeek,
      }),
    (err) => err.status === 409 && /unpaid fines/i.test(err.message)
  );

  // Borrow limit (5 active books) blocks 6th
  const dbLimit = createCirculationMockDb({
    library_cards: [{ id: 203, user_id: 50, valid_until: addDaysToIsoDate(today, 30) }],
    library_card_books: [
      { id: 401, card_id: 203, book_id: 10, quantity: 5, loan_status: "borrowed" },
    ],
  });
  await assert.rejects(
    () =>
      mutateLibraryCards(dbLimit, ADMIN_SESSION, "create", null, {
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        book_id: 10,
        date_return: nextWeek,
      }),
    (err) => err.status === 409 && /limit/i.test(err.message)
  );
});

test("5. Return restores copy to Available and calculates server-side fine; Renew blocks overdue & max renewals", async () => {
  const today = getManilaTodayISO();
  const threeDaysAgo = addDaysToIsoDate(today, -3);

  const supabase = createCirculationMockDb({
    book_copies: [
      { id: 100, book_id: 10, copy_number: 1, accession_number: "ACC-1", condition: "Good", circulation_status: "Borrowed" },
    ],
    library_cards: [
      {
        id: 200,
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        date_issued: addDaysToIsoDate(today, -10),
        date_return: threeDaysAgo,
        renewal1_checked: false,
        renewal2_checked: false,
      },
    ],
    library_card_books: [
      { id: 300, card_id: 200, book_id: 10, copy_id: 100, book_title: "Clean Code", book_author: "R. Martin", book_isbn: "123", quantity: 1, loan_status: "borrowed" },
    ],
  });

  // Renew refuses overdue loan
  await assert.rejects(
    () => mutateLibraryCards(supabase, LIBRARIAN_SESSION, "renew", 200, {}),
    (err) => err.status === 409 && /overdue/i.test(err.message)
  );

  // Return restores copy and calculates 3 days * PHP 5 = PHP 15
  const ret = await mutateLibraryCards(supabase, LIBRARIAN_SESSION, "return_books", 200, {
    return_date: today,
  });
  assert.equal(ret.ok, true);
  assert.equal(ret.overdue_days, 3);
  assert.equal(ret.fine_amount, 3 * CIRCULATION_RULES.DAILY_OVERDUE_FINE_PHP);
  assert.equal(supabase.db.book_copies[0].circulation_status, "Available");
});

test("6. Mark lost requires reason & applies fee; Waive fine is admin-only", async () => {
  const supabase = createCirculationMockDb({
    book_copies: [
      { id: 100, book_id: 10, copy_number: 1, accession_number: "ACC-1", condition: "Good", circulation_status: "Borrowed" },
    ],
    library_cards: [{ id: 200, card_type_category: "borrower", firstname: "Walk", lastname: "In" }],
    library_card_books: [{ id: 300, card_id: 200, book_id: 10, copy_id: 100, quantity: 1, loan_status: "borrowed" }],
  });

  const lostRes = await mutateLibraryCards(supabase, LIBRARIAN_SESSION, "mark_lost", 200, {
    card_book_id: 300,
    reason: "Patron reported book lost on jeepney",
  });
  assert.equal(lostRes.ok, true);
  assert.equal(lostRes.fee_amount, 750);
  assert.equal(supabase.db.book_copies[0].condition, "Lost");
  assert.equal(supabase.db.book_copies[0].circulation_status, "Unusable");

  // Librarian cannot waive fine -> 403
  await assert.rejects(
    () =>
      mutateLibraryCards(supabase, LIBRARIAN_SESSION, "waive_fine", 200, {
        card_book_id: 300,
        reason: "Trying as librarian",
      }),
    (err) => err.status === 403
  );

  // Admin can waive fine with reason
  const waived = await mutateLibraryCards(supabase, ADMIN_SESSION, "waive_fine", 200, {
    card_book_id: 300,
    reason: "Approved humanitarian waiver",
  });
  assert.equal(waived.ok, true);
  assert.equal(supabase.db.library_card_books[0].fine_waived, true);
});

test("7. Member privacy & Librarian patron redaction + CSV formula sanitization", async () => {
  const today = getManilaTodayISO();
  const supabase = createCirculationMockDb({
    library_cards: [
      {
        id: 210,
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        phone_number: "09171234567",
        address: "123 Secret St",
        date_issued: today,
        date_return: addDaysToIsoDate(today, 7),
      },
      {
        id: 211,
        card_type_category: "member",
        user_id: 51,
        firstname: "Member",
        lastname: "B",
        phone_number: "09179999999",
        address: "456 Hidden Ave",
        date_issued: today,
        date_return: addDaysToIsoDate(today, 7),
      },
    ],
  });

  // Member A only sees own card (210), never Member B's card (211)
  const memberAData = await getMemberBorrowedBooks(supabase, 50);
  assert.equal(memberAData.cards.length, 1);
  assert.equal(memberAData.cards[0].id, 210);

  // Member A cannot request renewal on Member B's card
  await assert.rejects(
    () => requestMemberCardRenewal(supabase, MEMBER_A_SESSION, 211, "Need more time"),
    (err) => err.status === 404
  );

  // Librarian view redacts member phone/address (omitted completely)
  const libView = await queryLibraryCards(supabase, { actorId: 2, sessionRole: "librarian" });
  assert.equal(libView.rows[0].phone_number, undefined);
  assert.equal(libView.rows[0].address, undefined);

  // CSV sanitizes leading formula characters
  const csv = buildBorrowHistoryCsv([{ id: 1, fullname: "=CMD('calc')", status: "active" }], {
    isLibrarian: true,
    resource: "library_cards",
  });
  assert.ok(csv.includes("'=CMD('calc')"));
});
