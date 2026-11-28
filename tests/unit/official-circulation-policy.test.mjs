import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CIRCULATION_POLICY as CANONICAL_POLICY } from "../../src/lib/circulation/policy.ts";
import {
  CIRCULATION_POLICY,
  CIRCULATION_RULES,
  addDaysToIsoDate,
  computeOverdueDays,
  computeOverdueFine,
  getManilaTodayISO,
  isLibraryClosedDay,
  isReferenceSectionBook,
  resolveEffectiveDueDate,
} from "../../src/lib/circulation/rules.ts";
import { CIRCULATION_POLICY as TYPES_POLICY } from "../../src/components/circulation/types.ts";
import { mutateBooks } from "../../src/repositories/books.ts";
import {
  loadLibraryHolidayDateSet,
  mutateLibraryHolidays,
  queryLibraryHolidays,
} from "../../src/repositories/holidays.ts";
import {
  mutateLibraryCards,
  queryLibraryCards,
  renewLibraryCardAtomically,
} from "../../src/repositories/library-cards.ts";
import {
  getMemberBorrowedBooks,
  requestMemberCardRenewal,
} from "../../src/repositories/member.ts";
import { libraryCardResolveReplacementSchema } from "../../src/validators/admin.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const policyFilePath = path.resolve(__dirname, "../../src/lib/circulation/policy.ts");

const ADMIN_SESSION = { userId: 1, email: "admin@library.local", role: "admin", name: "Admin" };
const LIBRARIAN_SESSION = { userId: 2, email: "lib@library.local", role: "librarian", name: "Lib" };
const MEMBER_SESSION = { userId: 50, email: "member@library.local", role: "user", name: "Member A" };

function createPolicyMockDb(initial = {}) {
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
        {
          id: 10,
          title: "Clean Code",
          author: "Robert Martin",
          isbn: "978-0132350884",
          cost_price: 750,
          is_borrowable: true,
          category: "Computer Science",
          class: "QA76",
        },
        {
          id: 11,
          title: "Philippine Encyclopedia",
          author: "Editorial Board",
          isbn: "978-0000000011",
          cost_price: 2500,
          is_borrowable: true, // even if true, Reference Section must be blocked
          category: "General Reference",
          class: "AE5",
        },
        {
          id: 12,
          title: "Iloilo Atlas",
          author: "Cartography Dept",
          isbn: "978-0000000012",
          cost_price: 1800,
          is_borrowable: true,
          category: "Geography",
          class: "G100",
        },
      ]
    ),
    book_inventory: structuredClone(
      initial.book_inventory ?? [
        { id: 1, book_id: 10, volumes: 2, available_copies: 2, borrowed_copies: 0, damaged_copies: 0, destroyed_copies: 0, lost_copies: 0, shelf_location: "Main Stack" },
        { id: 2, book_id: 11, volumes: 1, available_copies: 1, borrowed_copies: 0, damaged_copies: 0, destroyed_copies: 0, lost_copies: 0, shelf_location: "Main Stack" },
        { id: 3, book_id: 12, volumes: 1, available_copies: 1, borrowed_copies: 0, damaged_copies: 0, destroyed_copies: 0, lost_copies: 0, shelf_location: "Reference Section" },
      ]
    ),
    book_copies: structuredClone(
      initial.book_copies ?? [
        { id: 100, book_id: 10, copy_number: 1, accession_number: "ICPL-0010-C001", condition: "Good", circulation_status: "Available", shelf_location: "Main Stack" },
        { id: 101, book_id: 10, copy_number: 2, accession_number: "ICPL-0010-C002", condition: "Good", circulation_status: "Available", shelf_location: "Main Stack" },
        { id: 110, book_id: 11, copy_number: 1, accession_number: "ICPL-0011-C001", condition: "Good", circulation_status: "Available", shelf_location: "Main Stack" },
        { id: 120, book_id: 12, copy_number: 1, accession_number: "ICPL-0012-C001", condition: "Good", circulation_status: "Available", shelf_location: "Reference Section" },
      ]
    ),
    library_cards: structuredClone(initial.library_cards ?? []),
    library_card_books: structuredClone(initial.library_card_books ?? []),
    book_returns: structuredClone(initial.book_returns ?? []),
    book_return_items: structuredClone(initial.book_return_items ?? []),
    account_requests: structuredClone(initial.account_requests ?? []),
    fine_payments: structuredClone(initial.fine_payments ?? []),
    library_holidays: structuredClone(initial.library_holidays ?? []),
  };

  let nextId = 8000;

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
          if (f.type === "gte") return String(val ?? "") >= String(f.val ?? "");
          if (f.type === "lte") return String(val ?? "") <= String(f.val ?? "");
          return true;
        })
      );

    const exec = () => {
      if (initial.missingTable === table) {
        return { data: null, error: { code: "42P01", message: `relation "${table}" does not exist` } };
      }

      const list = db[table] ?? [];
      if (state.op === "select") {
        let out = applyFilters(list);
        if (state.orderBy) {
          const { col, ascending } = state.orderBy;
          out = [...out].sort((a, b) => {
            const av = a[col] ?? "";
            const bv = b[col] ?? "";
            return ascending ? (av > bv ? 1 : av < bv ? -1 : 0) : av < bv ? 1 : av > bv ? -1 : 0;
          });
        }
        if (state.limitVal !== null) out = out.slice(0, state.limitVal);
        if (state.singleMode) return { data: out[0] ?? null, error: null };
        return { data: out, error: null };
      }

      if (state.op === "insert") {
        const rowsToAdd = Array.isArray(state.payload) ? state.payload : [state.payload];
        for (const r of rowsToAdd) {
          if (table === "library_holidays" && list.some((h) => h.holiday_date === r.holiday_date)) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          }
          if (table === "fine_payments" && list.some((p) => p.idempotency_key === r.idempotency_key)) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          }
        }
        const inserted = rowsToAdd.map((r) => {
          const row = { id: ++nextId, created_at: new Date().toISOString(), ...r };
          list.push(row);
          return row;
        });
        return { data: state.singleMode ? inserted[0] : inserted, error: null };
      }

      if (state.op === "upsert") {
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
          if (table === "library_holidays" && state.payload?.holiday_date) {
            const dup = list.find((h) => h.id !== t.id && h.holiday_date === state.payload.holiday_date);
            if (dup) {
              return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
            }
          }
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
        return { data: state.singleMode ? (removed[0] ?? null) : removed, error: null };
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
      gte(col, val) { state.filters.push({ type: "gte", col, val }); return builder; },
      lte(col, val) { state.filters.push({ type: "lte", col, val }); return builder; },
      not() { return builder; },
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

test("1. Official circulation policy constants, sync across modules, and zero imports in policy.ts", () => {
  assert.equal(CANONICAL_POLICY.MAX_ACTIVE_BORROWS, 2);
  assert.equal(CANONICAL_POLICY.DEFAULT_LOAN_DAYS, 3);
  assert.equal(CANONICAL_POLICY.DAILY_OVERDUE_FINE_PHP, 10);
  assert.equal(CANONICAL_POLICY.FINE_DAY_MODE, "working");
  assert.equal("MAX_OVERDUE_FINE_PHP" in CANONICAL_POLICY, false);
  assert.equal("DAMAGED_FEE_PHP" in CANONICAL_POLICY, false);
  assert.equal("LOST_FEE_PHP" in CANONICAL_POLICY, false);

  assert.deepStrictEqual(CIRCULATION_POLICY, CANONICAL_POLICY);
  assert.deepStrictEqual(CIRCULATION_RULES, CANONICAL_POLICY);
  assert.deepStrictEqual(TYPES_POLICY, CANONICAL_POLICY);

  const source = fs.readFileSync(policyFilePath, "utf8");
  assert.equal(/^\s*import\b/m.test(source), false);
  assert.equal(/\bimport\s*\(/m.test(source), false);
  assert.equal(/\brequire\s*\(/m.test(source), false);
});

test("2. Working-day fines: Mon-Sat open, Sunday/holiday exclusions, closed due-date shift, Manila midnight, and uncapped fines", async () => {
  // Mon 2026-11-23 due -> Sat 2026-11-28 return = 5 working days (Tue-Sat inclusive) -> PHP 50
  assert.equal(computeOverdueDays("2026-11-23", "2026-11-28"), 5);
  assert.equal(computeOverdueFine(5, 1), 50);

  // Sat 2026-11-21 due -> Tue 2026-11-24 return spans Sun 2026-11-22 -> 2 working days (Mon, Tue) -> PHP 20
  assert.equal(computeOverdueDays("2026-11-21", "2026-11-24"), 2);
  assert.equal(computeOverdueFine(2, 1), 20);

  // Holiday inside overdue range is excluded
  const holidays = new Set(["2026-11-24"]);
  assert.equal(computeOverdueDays("2026-11-21", "2026-11-24", holidays), 1);
  assert.equal(computeOverdueFine(1, 1), 10);

  // Due date on closed day (Sunday 2026-11-22) shifts effective due date to Monday 2026-11-23
  assert.equal(isLibraryClosedDay("2026-11-22"), true);
  assert.equal(isLibraryClosedDay("2026-11-21"), false); // Saturday is open!
  assert.equal(isLibraryClosedDay("2026-11-24", holidays), true);
  assert.equal(resolveEffectiveDueDate("2026-11-22"), "2026-11-23");
  assert.equal(resolveEffectiveDueDate("2026-11-22", new Set(["2026-11-23"])), "2026-11-24");

  // Returning on shifted effective due date = 0 overdue days & 0 fine
  assert.equal(computeOverdueDays("2026-11-22", "2026-11-23"), 0);
  assert.equal(computeOverdueFine(0, 2), 0);
  // Returning 1 working day after shifted effective due date = 1 day -> PHP 10
  assert.equal(computeOverdueDays("2026-11-22", "2026-11-24"), 1);
  // Returning on original due date = 0 fine
  assert.equal(computeOverdueDays("2026-11-23", "2026-11-23"), 0);

  // Asia/Manila midnight boundary: 15:59:59Z is 23:59:59 Manila same day; 16:00:00Z is 00:00:00 next day
  assert.equal(getManilaTodayISO(new Date("2026-11-25T15:59:59Z")), "2026-11-25");
  assert.equal(getManilaTodayISO(new Date("2026-11-25T16:00:00Z")), "2026-11-26");

  // No fine cap
  assert.equal(computeOverdueFine(100, 2), 2000);
  assert.equal(computeOverdueFine(200, 1), 2000);
});

test("3. library_holidays admin-only CRUD, RBAC (403 librarian), unique date 409, and missing-table fallback", async () => {
  const missingDb = createPolicyMockDb({ missingTable: "library_holidays" });
  const emptySet = await loadLibraryHolidayDateSet(missingDb);
  assert.equal(emptySet.size, 0);

  const db = createPolicyMockDb();

  // Librarian cannot read or write holidays (403)
  await assert.rejects(
    () => queryLibraryHolidays(db, { actorId: 2 }),
    (err) => err.status === 403
  );
  await assert.rejects(
    () =>
      mutateLibraryHolidays(db, LIBRARIAN_SESSION, "create", null, {
        holiday_date: "2026-12-25",
        name: "Christmas Day",
      }),
    (err) => err.status === 403
  );

  // Unknown field rejected 400
  await assert.rejects(
    () =>
      mutateLibraryHolidays(db, ADMIN_SESSION, "create", null, {
        holiday_date: "2026-12-25",
        name: "Christmas Day",
        unknownField: true,
      }),
    (err) => err.status === 400
  );

  // Admin creates, updates, queries, and deletes holiday
  const created = await mutateLibraryHolidays(db, ADMIN_SESSION, "create", null, {
    holiday_date: "2026-12-25",
    name: "Christmas Day",
  });
  assert.equal(created.ok, true);

  // Duplicate date -> 409
  await assert.rejects(
    () =>
      mutateLibraryHolidays(db, ADMIN_SESSION, "create", null, {
        holiday_date: "2026-12-25",
        name: "Duplicate",
      }),
    (err) => err.status === 409
  );

  const loadedSet = await loadLibraryHolidayDateSet(db);
  assert.equal(loadedSet.has("2026-12-25"), true);

  const updated = await mutateLibraryHolidays(db, ADMIN_SESSION, "update", Number(created.id), {
    name: "Christmas Holiday",
  });
  assert.equal(updated.ok, true);

  const queried = await queryLibraryHolidays(db, { actorId: 1, from: "2026-12-01", to: "2026-12-31" });
  assert.equal(queried.total, 1);
  assert.equal(queried.rows[0].name, "Christmas Holiday");

  const deleted = await mutateLibraryHolidays(db, ADMIN_SESSION, "delete", Number(created.id), {});
  assert.equal(deleted.ok, true);
  assert.equal((await loadLibraryHolidayDateSet(db)).size, 0);
});

test("4. Replacement workflow: damaged/lost set replacement_pending (0 fee), lost requires affidavit, blocks borrows & renewals, and resolve_replacement paths", async () => {
  const today = getManilaTodayISO();
  const db = createPolicyMockDb({
    library_cards: [
      {
        id: 200,
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        date_issued: addDaysToIsoDate(today, -5),
        date_return: addDaysToIsoDate(today, 2),
        valid_until: addDaysToIsoDate(today, 90),
        renewal1_checked: false,
        renewal2_checked: false,
      },
      {
        id: 201,
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        date_issued: today,
        date_return: addDaysToIsoDate(today, 3),
        valid_until: addDaysToIsoDate(today, 90),
        renewal1_checked: false,
        renewal2_checked: false,
      },
    ],
    library_card_books: [
      { id: 300, card_id: 200, book_id: 10, copy_id: 100, book_title: "Clean Code", quantity: 1, loan_status: "borrowed" },
      { id: 301, card_id: 201, book_id: 10, copy_id: 101, book_title: "Clean Code", quantity: 1, loan_status: "borrowed" },
    ],
  });
  db.db.book_copies[0].circulation_status = "Borrowed";
  db.db.book_copies[1].circulation_status = "Borrowed";

  // Lost return without affidavit_reference -> 400
  await assert.rejects(
    () =>
      mutateLibraryCards(db, LIBRARIAN_SESSION, "return_books", 200, {
        items: [{ card_book_id: 300, qty_returned: 1, return_condition: "Lost" }],
      }),
    (err) => err.status === 400 && /affidavit/i.test(err.message)
  );

  // Lost return WITH affidavit_reference -> replacement_pending with 0 charge
  const lostRet = await mutateLibraryCards(db, LIBRARIAN_SESSION, "return_books", 200, {
    items: [
      {
        card_book_id: 300,
        qty_returned: 1,
        return_condition: "Lost",
        condition_notes: "Lost in transit",
        affidavit_reference: "AFF-2026-991",
      },
    ],
  });
  assert.equal(lostRet.ok, true);
  assert.equal(lostRet.fine_amount, 0);
  assert.equal(db.db.library_card_books[0].loan_status, "replacement_pending");
  assert.equal(db.db.library_card_books[0].fine_amount, 0);
  assert.equal(db.db.library_card_books[0].affidavit_reference, "AFF-2026-991");
  assert.equal(db.db.book_copies[0].circulation_status, "Unusable");

  // Pending replacement blocks new borrows (409)
  await assert.rejects(
    () =>
      mutateLibraryCards(db, LIBRARIAN_SESSION, "create", null, {
        card_type_category: "member",
        user_id: 50,
        firstname: "Member",
        lastname: "A",
        book_id: 10,
      }),
    (err) => err.status === 409 && /replacement/i.test(err.message)
  );

  // Pending replacement blocks renewals (both staff atomic renew & member renewal request & member view reason)
  await assert.rejects(
    () => renewLibraryCardAtomically(db, 200, today),
    (err) => err.status === 409 && /replacement/i.test(err.message)
  );
  await assert.rejects(
    () => renewLibraryCardAtomically(db, 201, today),
    (err) => err.status === 409 && /replacement/i.test(err.message)
  );
  await assert.rejects(
    () => requestMemberCardRenewal(db, MEMBER_SESSION, 201, "Need more time"),
    (err) => err.status === 409 && /replacement/i.test(err.message)
  );
  const memberView = await getMemberBorrowedBooks(db, 50);
  const card200View = memberView.cards.find((c) => c.id === 200);
  const card201View = memberView.cards.find((c) => c.id === 201);
  assert.equal(card200View.loan_status, "replacement_pending");
  assert.equal(card200View.renew_block_reason, "replacement_pending");
  assert.equal(card201View.renew_block_reason, "replacement_pending");

  // queryLibraryCards exposes has_replacement_pending and status="replacement_pending"
  const staffView = await queryLibraryCards(db, { id: 200, actorId: 1, sessionRole: "admin" });
  assert.equal(staffView.card.has_replacement_pending, true);
  assert.equal(staffView.card.status, "replacement_pending");
  assert.equal(staffView.card.is_returned, false);

  // Strict schema rejects unknown fields on resolve_replacement
  assert.equal(
    libraryCardResolveReplacementSchema.safeParse({
      card_book_id: 300,
      resolution: "replaced",
      reason: "Replaced",
      extra: true,
    }).success,
    false
  );

  // Librarian resolves replacement with "replaced": adds new copy, keeps old copy Unusable, updates inventory & unblocks
  const replaced = await mutateLibraryCards(db, LIBRARIAN_SESSION, "resolve_replacement", 200, {
    card_book_id: 300,
    resolution: "replaced",
    reason: "Patron submitted new hardcover replacement",
    replacement_condition: "Good",
  });
  assert.equal(replaced.ok, true);
  assert.equal(replaced.loan_status, "replaced");
  assert.ok(replaced.replacement_copy_id);
  assert.equal(db.db.book_copies[0].circulation_status, "Unusable");
  const addedCopy = db.db.book_copies.find((c) => c.id === replaced.replacement_copy_id);
  assert.ok(addedCopy);
  assert.equal(addedCopy.circulation_status, "Available");
  assert.equal(addedCopy.copy_number, 3);
  assert.equal(db.db.book_inventory[0].volumes, 3);
  assert.equal(db.db.book_inventory[0].available_copies, 1);

  const staffViewAfter = await queryLibraryCards(db, { id: 200, actorId: 1, sessionRole: "admin" });
  assert.equal(staffViewAfter.card.is_returned, true);
  assert.equal(staffViewAfter.card.status, "returned");

  // Borrow is now unblocked!
  const newBorrow = await mutateLibraryCards(db, LIBRARIAN_SESSION, "create", null, {
    card_type_category: "member",
    user_id: 50,
    firstname: "Member",
    lastname: "A",
    book_id: 10,
  });
  assert.equal(newBorrow.ok, true);
});

test("5. Replacement paid_equivalent & waived paths: City Librarian approval, fine_payments idempotency, and admin-only waiver", async () => {
  const db = createPolicyMockDb({
    library_cards: [{ id: 220, card_type_category: "member", user_id: 50, firstname: "M", lastname: "A" }],
    library_card_books: [
      { id: 320, card_id: 220, book_id: 10, copy_id: 100, quantity: 1, loan_status: "borrowed" },
      { id: 321, card_id: 220, book_id: 10, copy_id: 101, quantity: 1, loan_status: "borrowed" },
    ],
  });

  // mark_damaged sets replacement_pending with 0 charge
  const dmg = await mutateLibraryCards(db, LIBRARIAN_SESSION, "mark_damaged", 220, {
    card_book_id: 320,
    reason: "Water-damaged pages",
  });
  assert.equal(dmg.ok, true);
  assert.equal(dmg.loan_status, "replacement_pending");
  assert.equal(db.db.library_card_books[0].fine_amount, 0);

  // paid_equivalent requires amount, idempotency_key, and approved_by_city_librarian === true
  await assert.rejects(
    () =>
      mutateLibraryCards(db, LIBRARIAN_SESSION, "resolve_replacement", 220, {
        card_book_id: 320,
        resolution: "paid_equivalent",
        reason: "Equivalent cash payment",
        amount: 750,
        idempotency_key: "rep-pay-key-001",
      }),
    (err) => err.status === 400 && /city librarian/i.test(err.message)
  );

  const paid = await mutateLibraryCards(db, LIBRARIAN_SESSION, "resolve_replacement", 220, {
    card_book_id: 320,
    resolution: "paid_equivalent",
    reason: "City Librarian approved equivalent cost payment",
    amount: 750,
    payment_method: "cash",
    idempotency_key: "rep-pay-key-001",
    approved_by_city_librarian: true,
  });
  assert.equal(paid.ok, true);
  assert.equal(paid.loan_status, "paid_equivalent");
  assert.equal(db.db.fine_payments.length, 1);
  assert.equal(db.db.library_card_books[0].fine_paid, true);

  // Mark second book lost and test admin-only waiver
  await mutateLibraryCards(db, LIBRARIAN_SESSION, "mark_lost", 220, {
    card_book_id: 321,
    reason: "Lost during typhoon",
    affidavit_reference: "AFF-2026-TYPHOON",
  });

  // Librarian cannot waive -> 403
  await assert.rejects(
    () =>
      mutateLibraryCards(db, LIBRARIAN_SESSION, "resolve_replacement", 220, {
        card_book_id: 321,
        resolution: "waived",
        reason: "Calamity waiver attempt",
      }),
    (err) => err.status === 403
  );

  // Admin can waive -> 200
  const waived = await mutateLibraryCards(db, ADMIN_SESSION, "resolve_replacement", 220, {
    card_book_id: 321,
    resolution: "waived",
    reason: "Approved calamity waiver",
  });
  assert.equal(waived.ok, true);
  assert.equal(waived.loan_status, "waived");
  assert.equal(db.db.library_card_books[1].fine_waived, true);
});

test("6. Room-use Reference Section enforcement blocks borrowing (400) and auto-sets is_borrowable=false on book create/update", async () => {
  assert.equal(isReferenceSectionBook({ category: "General Reference", is_borrowable: true }), true);
  assert.equal(isReferenceSectionBook({ shelf_location: "Reference Section", is_borrowable: true }), true);
  assert.equal(isReferenceSectionBook({ category: "Fiction", is_borrowable: true }), false);

  const db = createPolicyMockDb();

  // Reference category book rejected (400) even with is_borrowable: true
  await assert.rejects(
    () =>
      mutateLibraryCards(db, LIBRARIAN_SESSION, "create", null, {
        card_type_category: "borrower",
        firstname: "Room",
        lastname: "Reader",
        book_id: 11,
      }),
    (err) => err.status === 400 && /reference/i.test(err.message)
  );

  // Reference shelf_location book/copy rejected (400) even with is_borrowable: true
  await assert.rejects(
    () =>
      mutateLibraryCards(db, LIBRARIAN_SESSION, "create", null, {
        card_type_category: "borrower",
        firstname: "Room",
        lastname: "Reader",
        book_id: 12,
        copy_id: 120,
      }),
    (err) => err.status === 400 && /reference/i.test(err.message)
  );

  // Creating a book in Reference Section automatically enforces is_borrowable = false
  const createdBook = await mutateBooks(db, ADMIN_SESSION, "create", null, {
    title: "Merriam-Webster Dictionary",
    author: "Merriam-Webster",
    category: "Reference",
    shelf_location: "Reference Section",
    is_borrowable: true,
  });
  assert.equal(createdBook.ok, true);
  const storedBook = db.db.books.find((b) => b.id === createdBook.id);
  assert.equal(storedBook.is_borrowable, false);
});
