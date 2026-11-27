import test from "node:test";
import assert from "node:assert/strict";
import { verifyRepositoryActor, touchSessionActivity } from "../../src/lib/auth/rbac.ts";
import { getActiveSessionStatus } from "../../src/services/auth.service.ts";
import { queryAccountsByRole, queryAdminUsers, mutateAccounts } from "../../src/repositories/users.ts";
import { queryAccountRequests, mutateAccountRequests } from "../../src/repositories/account-requests.ts";
import { queryLibraryCards, mutateLibraryCards } from "../../src/repositories/library-cards.ts";
import { queryReturns } from "../../src/repositories/returns.ts";
import { queryAdminProfile, mutateAdminProfile } from "../../src/repositories/admin-profile.ts";
import { queryDashboardStats } from "../../src/repositories/dashboard.repository.ts";
import {
  querySystemSettings,
  queryErrorLogs,
  queryBackupLogs,
  mutateSystemSettings,
} from "../../src/repositories/system-settings.ts";
import { mutateEventCategories, queryEvents } from "../../src/repositories/events.ts";
import { queryAnnouncements } from "../../src/repositories/announcements.ts";
import { buildBorrowHistoryCsv } from "../../src/lib/circulation/rules.ts";
import { adminUpdateProfileSchema } from "../../src/validators/admin.ts";

const ADMIN_SESSION = {
  userId: 1,
  email: "admin@iloilolibrary.gov.ph",
  role: "admin",
  sessionToken: "tok-admin-active",
};

const LIBRARIAN_SESSION = {
  userId: 2,
  email: "librarian@iloilolibrary.gov.ph",
  role: "librarian",
  sessionToken: "tok-lib-active",
};

const FORBIDDEN_PATRON_FIELDS = [
  "email",
  "username",
  "phone_number",
  "office_phone",
  "address",
  "city",
  "province",
  "age",
  "gender",
  "school",
  "occupation",
  "valid_id_path",
  "valid_id_url",
  "otp_enabled",
  "pin_enabled",
  "failed_attempts",
  "lock_until",
  "password",
  "pin_code",
  "otp_code",
  "reset_token",
  "session_token",
];

function createSecurityMockDb(initial = {}) {
  const db = {
    users: structuredClone(
      initial.users ?? [
        {
          id: 1,
          username: "admin@iloilolibrary.gov.ph",
          email_display: "admin@iloilolibrary.gov.ph",
          firstname: "Alice",
          lastname: "Admin",
          role: "admin",
          status: "active",
          is_active: true,
          is_approved: true,
          is_locked: false,
          failed_attempts: 0,
          lock_until: null,
          password: "$2b$12$fakehashadminpassword",
          pin_code: "$2b$12$fakehashadminpin",
          pin_set_at: new Date().toISOString(),
          otp_enabled: true,
          pin_enabled: true,
          last_seen: new Date().toISOString(),
        },
        {
          id: 2,
          username: "librarian@iloilolibrary.gov.ph",
          email_display: "librarian@iloilolibrary.gov.ph",
          firstname: "Lina",
          lastname: "Librarian",
          role: "librarian",
          status: "active",
          is_active: true,
          is_approved: true,
          is_locked: false,
          failed_attempts: 0,
          lock_until: null,
          password: "$2b$12$fakehashlibpassword",
          pin_code: "$2b$12$fakehashlibpin",
          pin_set_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days old (expired)
          otp_enabled: false,
          pin_enabled: false,
          last_seen: new Date().toISOString(),
        },
        {
          id: 50,
          username: "juan.patron@example.com",
          email_display: "juan.patron@example.com",
          firstname: "Juan",
          lastname: "Dela Cruz",
          phone_number: "09171234567",
          office_phone: "033-335-1234",
          city: "Iloilo City",
          province: "Iloilo",
          age: "24",
          gender: "Male",
          school: "UP Visayas",
          occupation: "Student",
          is_government: false,
          valid_id_path: "/Iloilo_Public_Library_Uploads/valid_ids/juan_id.png",
          role: "user",
          status: "active",
          is_active: true,
          is_approved: true,
          is_locked: false,
          failed_attempts: 2,
          lock_until: null,
          otp_enabled: true,
          pin_enabled: true,
          password: "$2b$12$fakehashpatronpassword",
          pin_code: "$2b$12$fakehashpatronpin",
          otp_code: "$2b$12$fakehashpatronotp",
          last_seen: new Date().toISOString(),
        },
      ]
    ),
    login_sessions: structuredClone(
      initial.login_sessions ?? [
        {
          id: 10,
          user_id: 1,
          session_token: "tok-admin-active",
          login_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
          logout_at: null,
        },
        {
          id: 11,
          user_id: 2,
          session_token: "tok-lib-active",
          login_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
          logout_at: null,
        },
      ]
    ),
    system_settings: structuredClone(
      initial.system_settings ?? [
        {
          id: 1,
          maintenance_enabled: false,
          maintenance_message: "Scheduled maintenance",
          bypass_role: "admin",
          lockdown_enabled: false,
          backup_frequency: "weekly",
        },
      ]
    ),
    account_requests: structuredClone(
      initial.account_requests ?? [
        {
          id: 301,
          user_id: 50,
          username: "juan.patron@example.com",
          request_type: "register",
          reason: "New account registration",
          status: "pending",
          admin_note: "",
          created_at: new Date().toISOString(),
          reviewed_at: null,
          card_id: null,
        },
        {
          id: 302,
          user_id: 50,
          username: "juan.patron@example.com",
          request_type: "renew",
          reason: "Extend loan",
          status: "pending",
          admin_note: "",
          created_at: new Date().toISOString(),
          reviewed_at: null,
          card_id: 401,
          renewal1_checked: true,
          renewal1_date: "2026-06-15",
          renewal2_checked: false,
          renewal2_date: null,
        },
        {
          id: 303,
          user_id: 50,
          username: "juan.patron@example.com",
          request_type: "deactivate",
          reason: "Closing account",
          status: "approved",
          admin_note: "",
          created_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          card_id: null,
        },
      ]
    ),
    library_cards: structuredClone(
      initial.library_cards ?? [
        {
          id: 401,
          card_type_category: "member",
          user_id: 50,
          firstname: "Juan",
          lastname: "Dela Cruz",
          phone_number: "09171234567",
          address: "123 Jaro St, Iloilo City",
          date_issued: "2026-06-01",
          date_return: "2026-06-08",
          card_type: "Adult",
          valid_until: "2027-06-01",
          registered_by: 2,
        },
        {
          id: 402,
          card_type_category: "borrower",
          user_id: null,
          firstname: "Maria",
          lastname: "Walkin",
          phone_number: "09189998888",
          address: "456 Molo Ave, Iloilo City",
          date_issued: "2026-06-01",
          date_return: "2026-06-08",
          card_type: "Walk-in",
          valid_until: "2026-06-08",
          registered_by: 2,
        },
      ]
    ),
    library_card_books: structuredClone(initial.library_card_books ?? []),
    book_returns: structuredClone(
      initial.book_returns ?? [
        {
          id: 501,
          card_id: 401,
          return_date: "2026-06-05",
          processed_by: 2,
          overdue_days: 0,
          fine_amount: 0,
          fine_paid: true,
          fine_waived: false,
        },
        {
          id: 502,
          card_id: 402,
          return_date: "2026-06-05",
          processed_by: 2,
          overdue_days: 0,
          fine_amount: 0,
          fine_paid: true,
          fine_waived: false,
        },
      ]
    ),
    book_return_items: structuredClone(
      initial.book_return_items ?? [
        {
          id: 601,
          return_id: 501,
          card_book_id: 1,
          book_title: "Noli Me Tangere",
          book_author: "Jose Rizal",
          book_isbn: "978-0000000001",
          qty_returned: 1,
          return_condition: "Good",
        },
        {
          id: 602,
          return_id: 502,
          card_book_id: 2,
          book_title: "El Filibusterismo",
          book_author: "Jose Rizal",
          book_isbn: "978-0000000002",
          qty_returned: 1,
          return_condition: "Good",
        },
      ]
    ),
    books: structuredClone(
      initial.books ?? [{ id: 1, title: "Noli Me Tangere", created_at: new Date().toISOString() }]
    ),
    book_inventory: structuredClone(
      initial.book_inventory ?? [
        { id: 1, book_id: 1, volumes: 5, available_copies: 4, damaged_copies: 0, lost_copies: 0 },
      ]
    ),
    backup_logs: structuredClone(initial.backup_logs ?? []),
    error_logs: structuredClone(initial.error_logs ?? []),
    announcements: structuredClone(
      initial.announcements ?? [
        { id: 701, title: "Public", body: "Hello all", target_user_id: null, pinned: false, created_at: new Date().toISOString() },
        { id: 702, title: "Private Notice", body: "For Juan", target_user_id: 50, pinned: false, created_at: new Date().toISOString() },
      ]
    ),
    events: structuredClone(
      initial.events ?? [
        { id: 801, title: "Public Event", event_date: "2026-07-01", audience: "all", category: "general" },
        { id: 802, title: "Staff Only", event_date: "2026-07-02", audience: "staff", category: "general" },
      ]
    ),
    event_categories: structuredClone(initial.event_categories ?? []),
  };

  let nextId = 9000;

  function from(table) {
    if (initial.failOnTable === table) {
      const failBuilder = {
        select: () => failBuilder,
        eq: () => failBuilder,
        neq: () => failBuilder,
        in: () => failBuilder,
        is: () => failBuilder,
        gte: () => failBuilder,
        or: () => failBuilder,
        order: () => failBuilder,
        limit: () => failBuilder,
        single: () => failBuilder,
        maybeSingle: () => failBuilder,
        then: (resolve) => resolve({ data: null, error: { message: "Simulated DB failure" } }),
      };
      return failBuilder;
    }

    const state = {
      op: "select",
      filters: [],
      limitVal: null,
      payload: null,
      singleMode: null,
      countMode: false,
      headOnly: false,
    };

    const applyFilters = (rows) =>
      rows.filter((row) =>
        state.filters.every((f) => {
          const val = row[f.col];
          if (f.type === "eq") return val === f.val;
          if (f.type === "neq") return val !== f.val;
          if (f.type === "in") return Array.isArray(f.val) && f.val.includes(val);
          if (f.type === "is") return val === f.val;
          if (f.type === "gte") return String(val ?? "") >= String(f.val ?? "");
          if (f.type === "or") {
            const clauses = String(f.val).split(",");
            return clauses.some((clause) => {
              const mIlike = clause.match(/^(\w+)\.ilike\.%(.*)%$/);
              if (mIlike) {
                return String(row[mIlike[1]] ?? "")
                  .toLowerCase()
                  .includes(mIlike[2].toLowerCase());
              }
              const mEq = clause.match(/^(\w+)\.eq\.(.*)$/);
              if (mEq) {
                return String(row[mEq[1]] ?? "") === mEq[2].replace(/^"|"$/g, "");
              }
              return false;
            });
          }
          return true;
        })
      );

    const exec = () => {
      const list = db[table] ?? [];
      if (state.op === "select") {
        let out = applyFilters(list);
        const count = out.length;
        if (state.limitVal !== null) out = out.slice(0, state.limitVal);
        if (state.headOnly) return { data: null, count, error: null };
        if (state.singleMode) return { data: out[0] ?? null, error: null };
        return { data: out, count: state.countMode ? count : undefined, error: null };
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
      select(_cols, opts) {
        if (opts?.count) state.countMode = true;
        if (opts?.head) state.headOnly = true;
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
      is(col, val) {
        state.filters.push({ type: "is", col, val });
        return builder;
      },
      gte(col, val) {
        state.filters.push({ type: "gte", col, val });
        return builder;
      },
      or(val) {
        state.filters.push({ type: "or", col: "", val });
        return builder;
      },
      order() {
        return builder;
      },
      limit(n) {
        state.limitVal = n;
        return builder;
      },
      single() {
        state.singleMode = "single";
        return builder;
      },
      maybeSingle() {
        state.singleMode = "maybeSingle";
        return builder;
      },
      then(resolve, reject) {
        try {
          resolve(exec());
        } catch (err) {
          if (reject) reject(err);
          else throw err;
        }
      },
    };
    return builder;
  }

  return { db, from };
}

test("1. Librarian receives 403 on EVERY admin-only repository resource (including stale admin cookie)", async () => {
  const supabase = createSecurityMockDb();

  // Admin-only reads rejected for librarian
  await assert.rejects(
    () => queryAccountsByRole(supabase, "admins", LIBRARIAN_SESSION.userId, LIBRARIAN_SESSION.sessionToken),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => queryAccountsByRole(supabase, "librarians", LIBRARIAN_SESSION.userId, LIBRARIAN_SESSION.sessionToken),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => querySystemSettings(supabase, LIBRARIAN_SESSION.userId, LIBRARIAN_SESSION.sessionToken),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => queryErrorLogs(supabase, LIBRARIAN_SESSION.userId, LIBRARIAN_SESSION.sessionToken),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => queryBackupLogs(supabase, LIBRARIAN_SESSION.userId, LIBRARIAN_SESSION.sessionToken),
    (err) => err.status === 403
  );

  // Admin-only writes rejected for librarian
  await assert.rejects(
    () => mutateAccounts(supabase, LIBRARIAN_SESSION, "users", "deactivate", 50, {}),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => mutateSystemSettings(supabase, LIBRARIAN_SESSION, "toggle_lockdown", { enabled: true, confirm: true, reason: "test" }),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => mutateEventCategories(supabase, LIBRARIAN_SESSION, "create", null, { slug: "x", name: "X", color: "#fff" }),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => mutateLibraryCards(supabase, LIBRARIAN_SESSION, "waive_fine", 401, { reason: "Please waive" }),
    (err) => err.status === 403
  );

  // Stale cookie claiming role: "admin" when DB role is "librarian" is STILL rejected with 403
  const staleAdminCookie = { ...LIBRARIAN_SESSION, role: "admin" };
  await assert.rejects(
    () => mutateSystemSettings(supabase, staleAdminCookie, "update_schedule", { frequency: "daily" }),
    (err) => err.status === 403
  );
});

test("2. Librarian cannot reach new-account/deactivate/delete account_requests by ID and sees only renewals", async () => {
  const supabase = createSecurityMockDb();

  // List returns ONLY request_type === "renew"
  const list = await queryAccountRequests(
    supabase,
    LIBRARIAN_SESSION.userId,
    LIBRARIAN_SESSION.sessionToken
  );
  assert.equal(list.rows.length, 1);
  assert.equal(list.rows[0].id, 302);
  assert.equal(list.rows[0].request_type, "renew");
  for (const field of FORBIDDEN_PATRON_FIELDS) {
    assert.equal(
      field in list.rows[0],
      false,
      `Forbidden field '${field}' leaked in librarian account_requests row`
    );
  }

  // Attempting to approve/reject/delete a new-account (register) request by ID returns 403
  await assert.rejects(
    () => mutateAccountRequests(supabase, LIBRARIAN_SESSION, "approve", 301, {}),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => mutateAccountRequests(supabase, LIBRARIAN_SESSION, "reject", 301, { note: "no" }),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => mutateAccountRequests(supabase, LIBRARIAN_SESSION, "delete", 303, {}),
    (err) => err.status === 403
  );

  // Missing ID ALSO returns 403 for librarian (no existence oracle between missing ID and non-renewal ID)
  await assert.rejects(
    () => mutateAccountRequests(supabase, LIBRARIAN_SESSION, "approve", 999999, {}),
    (err) => err.status === 403
  );

  // Even a stale cookie claiming role="admin" for a DB librarian cannot approve a register request
  const staleAdminCookie = { ...LIBRARIAN_SESSION, role: "admin" };
  await assert.rejects(
    () => mutateAccountRequests(supabase, staleAdminCookie, "approve", 301, {}),
    (err) => err.status === 403
  );
});

test("3. Patron PII is strictly redacted for librarians in JSON & CSV (both member and borrower cards) with no email/phone search oracle", async () => {
  const supabase = createSecurityMockDb();

  // 3a. queryAccountsByRole("users")
  const usersRes = await queryAccountsByRole(
    supabase,
    "users",
    LIBRARIAN_SESSION.userId,
    LIBRARIAN_SESSION.sessionToken
  );
  assert.equal(usersRes.rows.length, 1);
  assert.equal(usersRes.rows[0].fullname, "Juan Dela Cruz");
  assert.equal(usersRes.rows[0].library_card_number, "LC-000401");
  for (const field of FORBIDDEN_PATRON_FIELDS) {
    assert.equal(field in usersRes.rows[0], false, `users row leaked '${field}'`);
  }

  // 3b. queryAdminUsers mode=full, mode=picker, and ?id=50
  const fullRes = await queryAdminUsers(supabase, LIBRARIAN_SESSION, {
    q: "",
    role: "all",
    mode: "full",
    limit: 25,
  });
  assert.equal(fullRes.users.length, 1);
  for (const field of FORBIDDEN_PATRON_FIELDS) {
    assert.equal(field in fullRes.users[0], false, `admin/users full leaked '${field}'`);
  }

  const byIdRes = await queryAdminUsers(supabase, LIBRARIAN_SESSION, {
    id: 50,
    q: "",
    role: "all",
    mode: "full",
    limit: 25,
  });
  assert.equal(byIdRes.user.fullname, "Juan Dela Cruz");
  assert.equal(byIdRes.user.library_card_number, "LC-000401");
  for (const field of FORBIDDEN_PATRON_FIELDS) {
    assert.equal(field in byIdRes.user, false, `admin/users?id= leaked '${field}'`);
  }

  // Librarian cannot inspect admin/librarian via ?id=
  await assert.rejects(
    () =>
      queryAdminUsers(supabase, LIBRARIAN_SESSION, {
        id: 1,
        q: "",
        role: "all",
        mode: "full",
        limit: 25,
      }),
    (err) => err.status === 403
  );

  // Email and phone search oracle removed for librarians
  const emailOracle = await queryAdminUsers(supabase, LIBRARIAN_SESSION, {
    q: "juan.patron@example.com",
    role: "all",
    mode: "full",
    limit: 25,
  });
  assert.equal(emailOracle.users.length, 0);

  const phoneOracle = await queryAdminUsers(supabase, LIBRARIAN_SESSION, {
    q: "09171234567",
    role: "member",
    mode: "picker",
    limit: 8,
  });
  assert.equal(phoneOracle.users.length, 0);

  // Name search still works
  const nameSearch = await queryAdminUsers(supabase, LIBRARIAN_SESSION, {
    q: "Juan",
    role: "member",
    mode: "picker",
    limit: 8,
  });
  assert.equal(nameSearch.users.length, 1);

  // 3c. queryLibraryCards redacts BOTH member AND borrower cards
  const cardsRes = await queryLibraryCards(supabase, {
    actorId: LIBRARIAN_SESSION.userId,
    sessionToken: LIBRARIAN_SESSION.sessionToken,
  });
  assert.equal(cardsRes.rows.length, 2);
  for (const row of cardsRes.rows) {
    assert.equal("phone_number" in row, false, `library_cards (${row.card_type_category}) leaked phone_number`);
    assert.equal("address" in row, false, `library_cards (${row.card_type_category}) leaked address`);
  }

  // 3d. queryReturns redacts BOTH member AND borrower cards
  const returnsRes = await queryReturns(supabase, {
    actorId: LIBRARIAN_SESSION.userId,
    sessionToken: LIBRARIAN_SESSION.sessionToken,
  });
  assert.equal(returnsRes.rows.length, 2);
  for (const row of returnsRes.rows) {
    assert.equal("phone_number" in row, false, `returns (${row.card_category}) leaked phone_number`);
  }

  // 3e. CSV export for librarian omits Phone and Address columns and values
  const cardsCsv = buildBorrowHistoryCsv(cardsRes.rows, {
    isLibrarian: true,
    resource: "library_cards",
  });
  assert.equal(cardsCsv.includes("Phone"), false);
  assert.equal(cardsCsv.includes("Address"), false);
  assert.equal(cardsCsv.includes("09171234567"), false);
  assert.equal(cardsCsv.includes("09189998888"), false);
  assert.equal(cardsCsv.includes("123 Jaro"), false);
  assert.equal(cardsCsv.includes("456 Molo"), false);

  const returnsCsv = buildBorrowHistoryCsv(returnsRes.rows, {
    isLibrarian: true,
    resource: "returns",
  });
  assert.equal(returnsCsv.includes("09171234567"), false);
  assert.equal(returnsCsv.includes("09189998888"), false);
});

test("4. Librarian cannot change own or another user's role or status", async () => {
  const supabase = createSecurityMockDb();

  // Profile update schema rejects role/status/is_active
  assert.equal(
    adminUpdateProfileSchema.safeParse({
      firstname: "Lina",
      lastname: "Librarian",
      role: "admin",
    }).success,
    false
  );
  assert.equal(
    adminUpdateProfileSchema.safeParse({
      firstname: "Lina",
      lastname: "Librarian",
      status: "active",
    }).success,
    false
  );
  assert.equal(
    adminUpdateProfileSchema.safeParse({
      firstname: "Lina",
      lastname: "Librarian",
      is_active: false,
    }).success,
    false
  );

  await assert.rejects(
    () =>
      mutateAdminProfile(supabase, LIBRARIAN_SESSION, "update_profile", {
        firstname: "Lina",
        lastname: "Librarian",
        role: "admin",
      }),
    (err) => err.status === 400
  );

  // Librarian cannot mutate any user account via mutateAccounts
  await assert.rejects(
    () => mutateAccounts(supabase, LIBRARIAN_SESSION, "librarians", "deactivate", 2, {}),
    (err) => err.status === 403
  );
});

test("5. Deactivated, unapproved, locked, or logged-out librarian cannot reuse old session; touchSessionActivity never revives status", async () => {
  // 5a. Deactivated librarian
  const dbDeactivated = createSecurityMockDb();
  dbDeactivated.db.users[1].is_active = false;
  dbDeactivated.db.users[1].status = "offline";

  await assert.rejects(
    () =>
      verifyRepositoryActor(
        dbDeactivated,
        LIBRARIAN_SESSION.userId,
        ["admin", "librarian"],
        LIBRARIAN_SESSION.sessionToken
      ),
    (err) => err.status === 401
  );

  const sessDeactivated = await getActiveSessionStatus(LIBRARIAN_SESSION, dbDeactivated);
  assert.equal(sessDeactivated.authenticated, false);

  // touchSessionActivity must NOT revive status="active" for deactivated user
  await touchSessionActivity(
    { ...LIBRARIAN_SESSION, sessionToken: "tok-unique-deact-check" },
    dbDeactivated
  );
  assert.equal(dbDeactivated.db.users[1].status, "offline");

  // 5b. Unapproved librarian
  const dbUnapproved = createSecurityMockDb();
  dbUnapproved.db.users[1].is_approved = false;
  await assert.rejects(
    () =>
      verifyRepositoryActor(
        dbUnapproved,
        LIBRARIAN_SESSION.userId,
        ["admin", "librarian"],
        LIBRARIAN_SESSION.sessionToken
      ),
    (err) => err.status === 401
  );
  assert.equal((await getActiveSessionStatus(LIBRARIAN_SESSION, dbUnapproved)).authenticated, false);

  // 5c. Locked librarian (lock_until in future)
  const dbLocked = createSecurityMockDb();
  dbLocked.db.users[1].is_locked = true;
  dbLocked.db.users[1].lock_until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await assert.rejects(
    () =>
      verifyRepositoryActor(
        dbLocked,
        LIBRARIAN_SESSION.userId,
        ["admin", "librarian"],
        LIBRARIAN_SESSION.sessionToken
      ),
    (err) => err.status === 401
  );
  assert.equal((await getActiveSessionStatus(LIBRARIAN_SESSION, dbLocked)).authenticated, false);

  // 5d. Logged-out / revoked login_sessions row
  const dbLoggedOut = createSecurityMockDb();
  dbLoggedOut.db.login_sessions[1].logout_at = new Date().toISOString();
  await assert.rejects(
    () =>
      verifyRepositoryActor(
        dbLoggedOut,
        LIBRARIAN_SESSION.userId,
        ["admin", "librarian"],
        LIBRARIAN_SESSION.sessionToken
      ),
    (err) => err.status === 401
  );
  assert.equal((await getActiveSessionStatus(LIBRARIAN_SESSION, dbLoggedOut)).authenticated, false);

  // 5e. getActiveSessionStatus returns DB role (not stale cookie role) & fails closed on DB error
  const dbNormal = createSecurityMockDb();
  const staleCookie = { ...LIBRARIAN_SESSION, role: "admin" };
  const statusRes = await getActiveSessionStatus(staleCookie, dbNormal);
  assert.equal(statusRes.authenticated, true);
  assert.equal(statusRes.user.role, "librarian");

  const dbBroken = createSecurityMockDb({ failOnTable: "users" });
  const brokenRes = await getActiveSessionStatus(LIBRARIAN_SESSION, dbBroken);
  assert.equal(brokenRes.authenticated, false);
});

test("6. Emergency lockdown blocks librarian (503) and terminates session, while NEVER locking out admin", async () => {
  const supabase = createSecurityMockDb();

  // Admin enables lockdown
  await mutateSystemSettings(supabase, ADMIN_SESSION, "toggle_lockdown", {
    enabled: true,
    confirm: true,
    reason: "Security drill",
  });

  // Admin still passes repository check & session status
  const adminActor = await verifyRepositoryActor(
    supabase,
    ADMIN_SESSION.userId,
    ["admin"],
    ADMIN_SESSION.sessionToken
  );
  assert.equal(adminActor.role, "admin");
  const adminSess = await getActiveSessionStatus(ADMIN_SESSION, supabase);
  assert.equal(adminSess.authenticated, true);

  // Librarian session was terminated (401 on old token) and even a fresh token is blocked with 503 during lockdown
  await assert.rejects(
    () =>
      verifyRepositoryActor(
        supabase,
        LIBRARIAN_SESSION.userId,
        ["admin", "librarian"],
        LIBRARIAN_SESSION.sessionToken
      ),
    (err) => err.status === 401
  );

  // Even without sessionToken check (or with a brand-new session row), lockdown returns 503
  await assert.rejects(
    () => verifyRepositoryActor(supabase, LIBRARIAN_SESSION.userId, ["admin", "librarian"]),
    (err) => err.status === 503 && err.code === "SYSTEM_LOCKDOWN"
  );

  // Public endpoints claiming staff access also block locked-down librarian
  await assert.rejects(
    () => queryAnnouncements(supabase, LIBRARIAN_SESSION.userId),
    (err) => err.status === 503
  );
  await assert.rejects(
    () => queryEvents(supabase, { isStaff: true, actorId: LIBRARIAN_SESSION.userId }),
    (err) => err.status === 503
  );
});

test("7. No secrets/session_token in admin_profile, expired PIN blocked, and librarian dashboard stats scoped", async () => {
  const supabase = createSecurityMockDb();

  // 7a. queryAdminProfile omits raw session_token and password/pin_code hashes
  const profileRes = await queryAdminProfile(
    supabase,
    LIBRARIAN_SESSION.userId,
    LIBRARIAN_SESSION.sessionToken
  );
  assert.equal("password" in profileRes.profile, false);
  assert.equal("pin_code" in profileRes.profile, false);
  assert.equal(profileRes.profile.pin_expired, true);
  for (const sess of profileRes.loginActivity) {
    assert.equal("session_token" in sess, false, "Raw session_token leaked in loginActivity");
  }

  // 7b. Enabling an expired (>7d) PIN is blocked with 400
  await assert.rejects(
    () =>
      mutateAdminProfile(supabase, LIBRARIAN_SESSION, "toggle_security", {
        method: "pin",
        enabled: true,
      }),
    (err) => err.status === 400 && err.message.toLowerCase().includes("expired")
  );

  // 7c. queryDashboardStats scopes pending_requests to renewals and omits admin-only fields for librarian
  const libStats = await queryDashboardStats(
    supabase,
    LIBRARIAN_SESSION.userId,
    LIBRARIAN_SESSION.sessionToken
  );
  assert.equal(libStats.pending_requests, 1); // Only the 1 pending renew request (not the pending register request)
  assert.equal("total_admins" in libStats, false);
  assert.equal("total_librarians" in libStats, false);
  assert.equal("roles" in libStats, false);
  assert.equal("status" in libStats, false);
  assert.equal("locked_users" in libStats, false);

  const adminStats = await queryDashboardStats(
    supabase,
    ADMIN_SESSION.userId,
    ADMIN_SESSION.sessionToken
  );
  assert.equal(adminStats.pending_requests, 2); // Both pending register + renew
  assert.equal(adminStats.total_admins, 1);
  assert.equal(adminStats.total_librarians, 1);
});

test("8. Single-card library_cards and returns lookup by id enforces RBAC, librarian redaction, and 404", async () => {
  const supabase = createSecurityMockDb();

  // 8a. library_cards by id as librarian: returns single card + redacted PII
  const libCardRes = await queryLibraryCards(supabase, {
    id: 401,
    actorId: LIBRARIAN_SESSION.userId,
    sessionToken: LIBRARIAN_SESSION.sessionToken,
  });
  assert.equal(libCardRes.total, 1);
  assert.equal(libCardRes.page, 1);
  assert.equal(libCardRes.pageSize, 1);
  assert.equal(libCardRes.totalPages, 1);
  assert.equal(libCardRes.rows.length, 1);
  assert.equal(libCardRes.card.id, 401);
  assert.equal(libCardRes.rows[0].id, 401);
  assert.equal("phone_number" in libCardRes.card, false);
  assert.equal("address" in libCardRes.card, false);
  assert.equal("phone_number" in libCardRes.rows[0], false);
  assert.equal("address" in libCardRes.rows[0], false);

  // 8b. library_cards by id as admin: includes decrypted phone_number & address
  const adminCardRes = await queryLibraryCards(supabase, {
    id: 401,
    actorId: ADMIN_SESSION.userId,
    sessionToken: ADMIN_SESSION.sessionToken,
  });
  assert.equal(adminCardRes.card.id, 401);
  assert.equal(adminCardRes.card.phone_number, "09171234567");
  assert.equal(adminCardRes.card.address, "123 Jaro St, Iloilo City");

  // 8c. library_cards by missing id returns 404
  await assert.rejects(
    () =>
      queryLibraryCards(supabase, {
        id: 999999,
        actorId: LIBRARIAN_SESSION.userId,
        sessionToken: LIBRARIAN_SESSION.sessionToken,
      }),
    (err) => err.status === 404
  );

  // 8d. library_cards by id as non-staff (member user #50) returns 403
  await assert.rejects(
    () =>
      queryLibraryCards(supabase, {
        id: 401,
        actorId: 50,
      }),
    (err) => err.status === 403
  );

  // 8e. returns by card id as librarian: filters to card_id=401 and redacts phone_number
  const libReturnsRes = await queryReturns(supabase, {
    id: 401,
    actorId: LIBRARIAN_SESSION.userId,
    sessionToken: LIBRARIAN_SESSION.sessionToken,
  });
  assert.equal(libReturnsRes.total, 1);
  assert.equal(libReturnsRes.rows.length, 1);
  assert.equal(libReturnsRes.rows[0].card_id, 401);
  assert.equal("phone_number" in libReturnsRes.rows[0], false);

  // 8f. returns by card id as admin: filters to card_id=401 and includes phone_number
  const adminReturnsRes = await queryReturns(supabase, {
    id: 401,
    actorId: ADMIN_SESSION.userId,
    sessionToken: ADMIN_SESSION.sessionToken,
  });
  assert.equal(adminReturnsRes.total, 1);
  assert.equal(adminReturnsRes.rows[0].card_id, 401);
  assert.equal(adminReturnsRes.rows[0].phone_number, "09171234567");

  // 8g. returns by card id with no returns returns empty paginated shape
  const emptyReturnsRes = await queryReturns(supabase, {
    id: 999999,
    actorId: LIBRARIAN_SESSION.userId,
    sessionToken: LIBRARIAN_SESSION.sessionToken,
  });
  assert.equal(emptyReturnsRes.total, 0);
  assert.equal(emptyReturnsRes.rows.length, 0);
  assert.equal(emptyReturnsRes.page, 1);
  assert.equal(emptyReturnsRes.totalPages, 1);

  // 8h. returns by id as non-staff (member user #50) returns 403
  await assert.rejects(
    () =>
      queryReturns(supabase, {
        id: 401,
        actorId: 50,
      }),
    (err) => err.status === 403
  );
});

test("9. admin_profile GET reports pin_valid, pin_days_left, and pin_enabled: false on expired PIN", async () => {
  const supabase = createSecurityMockDb();
  // Even if DB still has pin_enabled: true on an expired PIN (>7 days), response must report pin_enabled: false
  supabase.db.users[1].pin_enabled = true;

  const expiredProfile = await queryAdminProfile(
    supabase,
    LIBRARIAN_SESSION.userId,
    LIBRARIAN_SESSION.sessionToken
  );
  assert.equal(expiredProfile.profile.has_pin, true);
  assert.equal(expiredProfile.profile.pin_expired, true);
  assert.equal(expiredProfile.profile.pin_valid, false);
  assert.equal(expiredProfile.profile.pin_days_left, 0);
  assert.equal(expiredProfile.profile.pin_enabled, false);

  // Active PIN set just now reports pin_valid: true, pin_days_left: 7, pin_enabled: true
  const validProfile = await queryAdminProfile(
    supabase,
    ADMIN_SESSION.userId,
    ADMIN_SESSION.sessionToken
  );
  assert.equal(validProfile.profile.has_pin, true);
  assert.equal(validProfile.profile.pin_expired, false);
  assert.equal(validProfile.profile.pin_valid, true);
  assert.equal(validProfile.profile.pin_days_left, 7);
  assert.equal(validProfile.profile.pin_enabled, true);
});

test("10. admin_profile update_profile supports partial updates and rejects empty, invalid, or unknown fields", async () => {
  const supabase = createSecurityMockDb();
  supabase.db.users[1].gender = "Female";
  supabase.db.users[1].phone_number = "09171112222";

  // 10a. Partial update with single field (firstname only) preserves untouched fields
  const partialRes = await mutateAdminProfile(supabase, LIBRARIAN_SESSION, "update_profile", {
    firstname: "Elena",
  });
  assert.equal(partialRes.ok, true);
  assert.equal(partialRes.profile.firstname, "Elena");
  assert.equal(partialRes.profile.lastname, "Librarian");
  assert.equal(partialRes.profile.fullname, "Elena Librarian");
  assert.equal(partialRes.profile.initials, "EL");
  assert.equal(partialRes.profile.gender, "Female");
  assert.equal(partialRes.profile.phone_number, "09171112222");
  assert.equal(supabase.db.users[1].lastname, "Librarian");
  assert.equal(supabase.db.users[1].gender, "Female");
  assert.equal(supabase.db.users[1].phone_number, "09171112222");

  // 10b. Empty payload {} rejected
  const emptyParsed = adminUpdateProfileSchema.safeParse({});
  assert.equal(emptyParsed.success, false);
  assert.equal(emptyParsed.error.issues[0]?.message, "At least one profile field is required.");
  await assert.rejects(
    () => mutateAdminProfile(supabase, LIBRARIAN_SESSION, "update_profile", {}),
    (err) => err.status === 400
  );

  // 10c. Invalid name rejected
  await assert.rejects(
    () => mutateAdminProfile(supabase, LIBRARIAN_SESSION, "update_profile", { firstname: "A" }),
    (err) => err.status === 400
  );
  await assert.rejects(
    () => mutateAdminProfile(supabase, LIBRARIAN_SESSION, "update_profile", { lastname: "12345" }),
    (err) => err.status === 400
  );

  // 10d. Invalid phone rejected
  await assert.rejects(
    () => mutateAdminProfile(supabase, LIBRARIAN_SESSION, "update_profile", { phone_number: "123" }),
    (err) => err.status === 400
  );

  // 10e. Unknown field rejected
  await assert.rejects(
    () =>
      mutateAdminProfile(supabase, LIBRARIAN_SESSION, "update_profile", {
        firstname: "Elena",
        unknownField: true,
      }),
    (err) => err.status === 400
  );
});
