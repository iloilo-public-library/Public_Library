import test from "node:test";
import assert from "node:assert/strict";
import {
  CIRCULATION_RULES,
  addDaysToIsoDate,
  computeOverdueDays,
  computeOverdueFine,
  getManilaTodayISO,
} from "../../src/lib/circulation/rules.ts";
import { mutateAccountRequests } from "../../src/repositories/account-requests.ts";
import { mutateLibraryCards, queryLibraryCards } from "../../src/repositories/library-cards.ts";
import {
  getMemberBorrowedBooks,
  getMemberReturnHistory,
  requestMemberCardRenewal,
} from "../../src/repositories/member.ts";
import { mutateReturns } from "../../src/repositories/returns.ts";

const ADMIN_SESSION = { userId: 1, email: "admin@library.local", role: "admin", name: "Admin" };
const LIBRARIAN_SESSION = { userId: 2, email: "lib@library.local", role: "librarian", name: "Lib" };
const MEMBER_SESSION = { userId: 50, email: "member@library.local", role: "user", name: "Member A" };

function createMockDb(initial = {}) {
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
        { id: 11, title: "Reserved Title", author: "Author B", isbn: "978-0000000002", cost_price: 400, is_borrowable: true },
      ]
    ),
    book_inventory: structuredClone(
      initial.book_inventory ?? [
        { id: 1, book_id: 10, volumes: 4, available_copies: 4, borrowed_copies: 0, damaged_copies: 0, destroyed_copies: 0, lost_copies: 0 },
      ]
    ),
    book_copies: structuredClone(
      initial.book_copies ?? [
        { id: 100, book_id: 10, copy_number: 1, condition: "Good", circulation_status: "Borrowed" },
        { id: 101, book_id: 10, copy_number: 2, condition: "Good", circulation_status: "Available" },
      ]
    ),
    library_cards: structuredClone(initial.library_cards ?? []),
    library_card_books: structuredClone(initial.library_card_books ?? []),
    book_returns: structuredClone(initial.book_returns ?? []),
    book_return_items: structuredClone(initial.book_return_items ?? []),
    account_requests: structuredClone(initial.account_requests ?? []),
    announcements: structuredClone(initial.announcements ?? []),
    fine_payments: structuredClone(initial.fine_payments ?? []),
  };

  let nextId = 7000;

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
      if (initial.failUpdateTable === table && state.op === "update") {
        return { data: null, error: initial.failUpdateError ?? { code: "23514", message: "Check constraint violation" } };
      }
      if (initial.failInsertTable === table && state.op === "insert") {
        return { data: null, error: initial.failInsertError ?? { code: "23514", message: "Check constraint violation" } };
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
        if (initial.simulateConcurrentSlotChange && table === "library_cards") {
          // Mutate renewal1_checked mid-flight so optimistic check must miss 0 rows
          for (const row of list) {
            if (row.id === 200) row.renewal1_checked = true;
          }
        }
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
      select() { return builder; },
      insert(p) { state.op = "insert"; state.payload = p; return builder; },
      update(p) { state.op = "update"; state.payload = p; return builder; },
      delete() { state.op = "delete"; return builder; },
      eq(col, val) { state.filters.push({ type: "eq", col, val }); return builder; },
      neq(col, val) { state.filters.push({ type: "neq", col, val }); return builder; },
      in(col, val) { state.filters.push({ type: "in", col, val }); return builder; },
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

test("1a. Member renew approval re-checks eligibility and advances date_return capped at MAX_LOAN_DAYS", async () => {
  const today = getManilaTodayISO();
  const initialDue = addDaysToIsoDate(today, 5);
  const expectedDue = addDaysToIsoDate(initialDue, CIRCULATION_RULES.RENEWAL_EXTENSION_DAYS); // +7d = today+12d <= 14d

  const db = createMockDb({
    library_cards: [
      {
        id: 200,
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        date_issued: today,
        date_return: initialDue,
        valid_until: addDaysToIsoDate(today, 180),
        renewal1_checked: false,
        renewal2_checked: false,
      },
      {
        id: 201,
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        date_issued: addDaysToIsoDate(today, -15),
        date_return: addDaysToIsoDate(today, -2), // Overdue
        valid_until: addDaysToIsoDate(today, 180),
        renewal1_checked: false,
        renewal2_checked: false,
      },
    ],
    library_card_books: [
      { id: 300, card_id: 200, book_id: 10, copy_id: 100, quantity: 1, loan_status: "borrowed" },
      { id: 301, card_id: 201, book_id: 10, copy_id: 101, quantity: 1, loan_status: "borrowed" },
    ],
    account_requests: [
      {
        id: 400,
        user_id: 50,
        request_type: "renew",
        status: "pending",
        card_id: 200,
        renewal1_checked: true,
        renewal1_date: today,
        renewal2_checked: false,
        renewal2_date: null,
      },
      {
        id: 401,
        user_id: 50,
        request_type: "renew",
        status: "pending",
        card_id: 201,
        renewal1_checked: true,
        renewal1_date: today,
        renewal2_checked: false,
        renewal2_date: null,
      },
    ],
  });

  // Approving overdue renewal 401 must be rejected (409)
  await assert.rejects(
    () => mutateAccountRequests(db, LIBRARIAN_SESSION, "approve", 401, {}),
    (err) => err.status === 409 && /overdue/i.test(err.message)
  );

  // Approving eligible renewal 400 advances date_return and marks renewal1_checked
  const res = await mutateAccountRequests(db, LIBRARIAN_SESSION, "approve", 400, {});
  assert.equal(res.ok, true);
  assert.equal(db.db.library_cards[0].date_return, expectedDue);
  assert.equal(db.db.library_cards[0].renewal1_checked, true);
});

test("1b. Staff renew checks unpaid fines, uses optimistic update on slots, and member renew maps 23505 to 409", async () => {
  const today = getManilaTodayISO();
  const dbRace = createMockDb({
    simulateConcurrentSlotChange: true,
    library_cards: [
      {
        id: 200,
        card_type_category: "member",
        user_id: 50,
        date_issued: today,
        date_return: addDaysToIsoDate(today, 3),
        valid_until: addDaysToIsoDate(today, 60),
        renewal1_checked: false,
        renewal2_checked: false,
      },
    ],
    library_card_books: [
      { id: 300, card_id: 200, book_id: 10, copy_id: 100, quantity: 1, loan_status: "borrowed" },
    ],
  });

  // Optimistic slot mismatch returns 409
  await assert.rejects(
    () => mutateLibraryCards(dbRace, LIBRARIAN_SESSION, "renew", 200, {}),
    (err) => err.status === 409
  );

  // Unpaid fine blocks staff renew
  const dbFined = createMockDb({
    library_cards: [
      {
        id: 210,
        card_type_category: "member",
        user_id: 50,
        date_issued: today,
        date_return: addDaysToIsoDate(today, 5),
        valid_until: addDaysToIsoDate(today, 60),
        renewal1_checked: false,
        renewal2_checked: false,
      },
      { id: 211, card_type_category: "member", user_id: 50, date_issued: addDaysToIsoDate(today, -10), date_return: addDaysToIsoDate(today, -3) },
    ],
    library_card_books: [
      { id: 310, card_id: 210, book_id: 10, copy_id: 100, quantity: 1, loan_status: "borrowed" },
    ],
    book_returns: [
      { id: 500, card_id: 211, fine_amount: 50, fine_paid: false, fine_waived: false },
    ],
  });
  await assert.rejects(
    () => mutateLibraryCards(dbFined, LIBRARIAN_SESSION, "renew", 210, {}),
    (err) => err.status === 409 && /fine/i.test(err.message)
  );

  // Postgres 23505 on duplicate pending renewal insert maps to 409 Conflict
  const dbDupIndex = createMockDb({
    failInsertTable: "account_requests",
    failInsertError: { code: "23505", message: "duplicate key value violates unique constraint uq_ar_pending_renew_card" },
    library_cards: [
      {
        id: 220,
        card_type_category: "member",
        user_id: 50,
        date_issued: today,
        date_return: addDaysToIsoDate(today, 5),
        valid_until: addDaysToIsoDate(today, 60),
        renewal1_checked: false,
        renewal2_checked: false,
      },
    ],
    library_card_books: [
      { id: 320, card_id: 220, book_id: 10, copy_id: 101, quantity: 1, loan_status: "borrowed" },
    ],
  });
  await assert.rejects(
    () => requestMemberCardRenewal(dbDupIndex, MEMBER_SESSION, 220, "Need extra week"),
    (err) => err.status === 409
  );
});

test("2. Unified fine formula (qty match, uncapped), damaged return replacement_pending (overdue-only), partial waiver sum, and DB error propagation", async () => {
  const today = getManilaTodayISO();
  const fourDaysAgo = addDaysToIsoDate(today, -4);
  const expectedDays = computeOverdueDays(fourDaysAgo, today);
  const expectedOverdue2 = computeOverdueFine(expectedDays, 2);

  // Uncapped fine & quantity multiplier (PHP 10/day)
  assert.equal(computeOverdueFine(4, 3), 120);
  assert.equal(computeOverdueFine(200, 3), 6000);
  assert.equal(computeOverdueDays("2026-11-23", "2026-11-27"), 4);

  // Active overdue display matches return fine for multi-qty loan (2 books * working days * PHP 10)
  const dbQty = createMockDb({
    book_copies: [], // test no-copy book_inventory damaged_copies fallback
    library_cards: [
      { id: 230, card_type_category: "member", user_id: 50, firstname: "M", lastname: "A", date_issued: addDaysToIsoDate(today, -11), date_return: fourDaysAgo },
    ],
    library_card_books: [
      { id: 330, card_id: 230, book_id: 10, copy_id: null, book_title: "Clean Code", quantity: 2, loan_status: "borrowed" },
    ],
  });
  const activeView = await queryLibraryCards(dbQty, { id: 230, actorId: 1, sessionRole: "admin" });
  assert.equal(activeView.card.fine_amount, expectedOverdue2);

  // Returning Damaged item sets replacement_pending with overdue fine ONLY (no flat incident fee)
  const retDamaged = await mutateLibraryCards(dbQty, ADMIN_SESSION, "return_books", 230, {
    items: [{ card_book_id: 330, qty_returned: 2, return_condition: "Damaged" }],
  });
  assert.equal(retDamaged.fine_amount, expectedOverdue2);
  assert.equal(dbQty.db.library_card_books[0].loan_status, "replacement_pending");
  assert.equal(dbQty.db.library_card_books[0].fine_amount, 0);
  // No-copy book_inventory incremented damaged_copies, NOT available_copies
  assert.equal(dbQty.db.book_inventory[0].damaged_copies, 2);
  assert.equal(dbQty.db.book_inventory[0].available_copies, 4);

  // Single-item waiver on a multi-fine card keeps remaining unwaived fine
  const dbWaive = createMockDb({
    library_cards: [
      { id: 240, card_type_category: "member", user_id: 50, firstname: "W", lastname: "A", date_issued: today, date_return: today },
    ],
    library_card_books: [
      { id: 340, card_id: 240, book_id: 10, quantity: 1, loan_status: "returned", fine_amount: 150, fine_waived: true, fine_paid: false },
      { id: 341, card_id: 240, book_id: 11, quantity: 1, loan_status: "lost", fine_amount: 500, fine_waived: false, fine_paid: false },
    ],
  });
  const waivedView = await queryLibraryCards(dbWaive, { id: 240, actorId: 1, sessionRole: "admin" });
  assert.equal(waivedView.card.fine_amount, 500);
  assert.equal(waivedView.card.fine_waived, false);

  // DB errors in return_books fallback must propagate, never be swallowed
  const dbErr = createMockDb({
    failUpdateTable: "library_card_books",
    library_cards: [
      { id: 250, card_type_category: "member", user_id: 50, date_issued: today, date_return: today },
    ],
    library_card_books: [
      { id: 350, card_id: 250, book_id: 10, copy_id: 100, quantity: 1, loan_status: "borrowed" },
    ],
  });
  await assert.rejects(
    () => mutateLibraryCards(dbErr, ADMIN_SESSION, "return_books", 250, {}),
    (err) => err.status >= 400
  );
});

test("3. record_fine_payment supports partial/full/idempotency/audit, and unpaid/live fines block new borrows", async () => {
  const today = getManilaTodayISO();
  const db = createMockDb({
    library_cards: [
      { id: 260, card_type_category: "member", user_id: 50, firstname: "Pay", lastname: "Patron", date_issued: addDaysToIsoDate(today, -10), date_return: addDaysToIsoDate(today, -5) },
    ],
    library_card_books: [
      { id: 360, card_id: 260, book_id: 10, copy_id: 100, quantity: 1, loan_status: "returned", fine_amount: 100, fine_paid: false, fine_waived: false },
    ],
  });

  // Live unpaid fine blocks new borrow
  await assert.rejects(
    () =>
      mutateLibraryCards(db, LIBRARIAN_SESSION, "create", null, {
        card_type_category: "member",
        user_id: 50,
        firstname: "Pay",
        lastname: "Patron",
        book_id: 10,
      }),
    (err) => err.status === 409 && /unpaid/i.test(err.message)
  );

  // Overpayment rejected 400
  await assert.rejects(
    () =>
      mutateLibraryCards(db, LIBRARIAN_SESSION, "record_fine_payment", 260, {
        amount: 150,
        idempotency_key: "pay-key-over-001",
      }),
    (err) => err.status === 400
  );

  // Partial payment (60 of 100) by librarian reduces balance to 40
  const p1 = await mutateLibraryCards(db, LIBRARIAN_SESSION, "record_fine_payment", 260, {
    amount: 60,
    payment_method: "cash",
    idempotency_key: "pay-key-part-001",
    note: "Partial cash",
  });
  assert.equal(p1.ok, true);
  assert.equal(p1.amount_paid, 60);
  assert.equal(p1.remaining_balance, 40);
  assert.equal(p1.fine_paid, false);
  assert.match(p1.audit_details, /record_fine_payment/);

  // Idempotent replay with same key returns previous payment without double charging
  const replay = await mutateLibraryCards(db, LIBRARIAN_SESSION, "record_fine_payment", 260, {
    amount: 60,
    idempotency_key: "pay-key-part-001",
  });
  assert.equal(replay.idempotent_replay, true);
  assert.equal(db.db.fine_payments.length, 1);

  // Remaining 40 settles balance, sets fine_paid=true, and unblocks borrow
  const p2 = await mutateLibraryCards(db, ADMIN_SESSION, "record_fine_payment", 260, {
    amount: 40,
    idempotency_key: "pay-key-full-002",
  });
  assert.equal(p2.remaining_balance, 0);
  assert.equal(p2.fine_paid, true);
  assert.equal(db.db.library_card_books[0].fine_paid, true);

  // Live accrued overdue fine on an active overdue loan (even without return row) also blocks borrow
  const dbLiveOverdue = createMockDb({
    library_cards: [
      { id: 261, card_type_category: "member", user_id: 50, date_issued: addDaysToIsoDate(today, -15), date_return: addDaysToIsoDate(today, -6), valid_until: addDaysToIsoDate(today, 90) },
    ],
    library_card_books: [
      { id: 361, card_id: 261, book_id: 10, copy_id: 100, quantity: 1, loan_status: "borrowed" },
    ],
  });
  await assert.rejects(
    () =>
      mutateLibraryCards(dbLiveOverdue, ADMIN_SESSION, "create", null, {
        card_type_category: "member",
        user_id: 50,
        firstname: "Live",
        lastname: "Overdue",
        book_id: 10,
      }),
    (err) => err.status === 409 && /unpaid|overdue/i.test(err.message)
  );
});

test("4. Member APIs return loan_status, overdue_days, fine_amount, renew_block_reason, and allow renewal when another copy is Available", async () => {
  const today = getManilaTodayISO();
  const db = createMockDb({
    book_copies: [
      { id: 100, book_id: 10, copy_number: 1, condition: "Good", circulation_status: "Borrowed" },
      { id: 101, book_id: 10, copy_number: 2, condition: "Good", circulation_status: "Reserved" },
      { id: 102, book_id: 10, copy_number: 3, condition: "Good", circulation_status: "Available" }, // Other copy Available -> allow renewal!
      { id: 200, book_id: 11, copy_number: 1, condition: "Good", circulation_status: "Borrowed" },
      { id: 201, book_id: 11, copy_number: 2, condition: "Good", circulation_status: "Reserved" }, // No Available copy -> block renewal!
    ],
    library_cards: [
      {
        id: 270,
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        date_issued: today,
        date_return: addDaysToIsoDate(today, 5),
        valid_until: addDaysToIsoDate(today, 90),
        renewal1_checked: false,
        renewal2_checked: false,
      },
      {
        id: 271,
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        date_issued: addDaysToIsoDate(today, -12),
        date_return: addDaysToIsoDate(today, -3),
        valid_until: addDaysToIsoDate(today, 90),
        renewal1_checked: false,
        renewal2_checked: false,
      },
      {
        id: 272,
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        date_issued: today,
        date_return: addDaysToIsoDate(today, 5),
        valid_until: addDaysToIsoDate(today, 90),
        renewal1_checked: false,
        renewal2_checked: false,
      },
    ],
    library_card_books: [
      { id: 370, card_id: 270, book_id: 10, copy_id: 100, book_title: "Clean Code", quantity: 1, loan_status: "borrowed" },
      { id: 371, card_id: 271, book_id: 10, copy_id: 100, book_title: "Clean Code", quantity: 1, loan_status: "borrowed" },
      { id: 372, card_id: 272, book_id: 11, copy_id: 200, book_title: "Reserved Title", quantity: 1, loan_status: "borrowed" },
    ],
    book_returns: [
      { id: 570, card_id: 270, return_date: "2026-11-10", overdue_days: 2, fine_amount: 10, fine_paid: false, fine_waived: false },
    ],
    book_return_items: [
      { id: 670, return_id: 570, card_book_id: 999, book_title: "Returned Book", qty_returned: 1, return_condition: "Good" },
    ],
  });

  const borrowed = await getMemberBorrowedBooks(db, 50);
  const c270 = borrowed.cards.find((c) => c.id === 270);
  const c271 = borrowed.cards.find((c) => c.id === 271);
  const c272 = borrowed.cards.find((c) => c.id === 272);

  const expectedDays271 = computeOverdueDays(addDaysToIsoDate(today, -3), today);
  assert.equal(c271.loan_status, "overdue");
  assert.equal(c271.overdue_days, expectedDays271);
  assert.equal(c271.fine_amount, computeOverdueFine(expectedDays271, 1));
  assert.equal(c271.renew_block_reason, "overdue");

  assert.equal(c272.renew_block_reason, "unpaid_fines");
  assert.ok("loan_status" in c270);
  assert.ok("overdue_days" in c270);
  assert.ok("fine_amount" in c270);
  assert.ok("renew_block_reason" in c270);

  // Clear unpaid fine on return 570 so reserved-copy rules and renewal eligibility take effect
  db.db.book_returns[0].fine_paid = true;
  const borrowedAfterPay = await getMemberBorrowedBooks(db, 50);
  const c270After = borrowedAfterPay.cards.find((c) => c.id === 270);
  const c272After = borrowedAfterPay.cards.find((c) => c.id === 272);
  assert.equal(c270After.can_renew, true);
  assert.equal(c270After.renew_block_reason, null);
  assert.equal(c272After.renew_block_reason, "reserved");

  const renewAllowed = await requestMemberCardRenewal(db, MEMBER_SESSION, 270, "Another copy is free");
  assert.equal(renewAllowed.ok, true);

  const hist = await getMemberReturnHistory(db, 50);
  assert.equal(hist.returns.length, 1);
  assert.equal(hist.returns[0].overdue_days, 2);
  assert.equal(hist.returns[0].fine_amount, 10);
  assert.equal(hist.returns[0].loan_status, "returned");
});

test("5. Return-item delete is restricted to Admin (403 for Librarian)", async () => {
  const db = createMockDb({
    book_return_items: [{ id: 800, return_id: 1, book_title: "Book", qty_returned: 1 }],
  });

  await assert.rejects(
    () => mutateReturns(db, LIBRARIAN_SESSION, "delete", 800, {}),
    (err) => err.status === 403
  );

  const ok = await mutateReturns(db, ADMIN_SESSION, "delete", 800, {});
  assert.equal(ok.ok, true);
});
