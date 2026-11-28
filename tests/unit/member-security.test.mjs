import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import {
  getMemberBorrowedBooks,
  getMemberReturnHistory,
  requestMemberCardRenewal,
  getMemberFavorites,
  toggleMemberFavorite,
  getMemberSearchHistory,
  addMemberSearchHistory,
  clearMemberSearchHistory,
  getMemberNotifications,
  updateMemberNotificationState,
  getMemberSettings,
  mutateMemberSettings,
  getMemberValidIdPath,
} from "../../src/repositories/member.ts";
import {
  registerUserAccountService,
  verifyPinService,
} from "../../src/services/auth.service.ts";
import { consumeConfirmedQrToken } from "../../src/lib/auth/qr.ts";
import { verifyRepositoryActor } from "../../src/lib/auth/rbac.ts";
import { clearRateLimitMemory } from "../../src/lib/auth/rate-limit.ts";
import {
  userSettingsMutationSchema,
  userSearchHistorySchema,
  userFavoriteSchema,
  userRenewCardSchema,
  userValidIdQuerySchema,
} from "../../src/validators/user.ts";

const PASSWORD_A = "MemberPass@123";
const PASSWORD_A_HASH = bcrypt.hashSync(PASSWORD_A, 4);
const PIN_HASH = bcrypt.hashSync("123456", 4);

const MEMBER_A = {
  userId: 101,
  email: "member.a@example.com",
  role: "user",
  sessionToken: "tok-member-a",
};

const MEMBER_B = {
  userId: 102,
  email: "member.b@example.com",
  role: "user",
  sessionToken: "tok-member-b",
};

const LIBRARIAN = {
  userId: 2,
  email: "librarian@iloilolibrary.gov.ph",
  role: "librarian",
  sessionToken: "tok-lib",
};

const ADMIN = {
  userId: 1,
  email: "admin@iloilolibrary.gov.ph",
  role: "admin",
  sessionToken: "tok-admin",
};

function createMemberMockDb(overrides = {}) {
  const nowIso = new Date().toISOString();
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const db = {
    users: structuredClone(
      overrides.users ?? [
        {
          id: 1,
          username: "admin@iloilolibrary.gov.ph",
          email_display: "admin@iloilolibrary.gov.ph",
          firstname: "Alice",
          lastname: "Admin",
          role: "admin",
          is_active: true,
          is_approved: true,
          is_locked: false,
          lock_until: null,
          password: PASSWORD_A_HASH,
        },
        {
          id: 2,
          username: "librarian@iloilolibrary.gov.ph",
          email_display: "librarian@iloilolibrary.gov.ph",
          firstname: "Lina",
          lastname: "Librarian",
          role: "librarian",
          is_active: true,
          is_approved: true,
          is_locked: false,
          lock_until: null,
          password: PASSWORD_A_HASH,
        },
        {
          id: 101,
          username: "member.a@example.com",
          email_display: "member.a@example.com",
          firstname: "Juan",
          lastname: "Alpha",
          gender: "Male",
          phone_number: "09171111111",
          city: "Iloilo City",
          province: "Iloilo",
          school: "UPV",
          occupation: "Student",
          role: "user",
          is_active: true,
          is_approved: true,
          is_locked: false,
          lock_until: null,
          failed_attempts: 0,
          password: PASSWORD_A_HASH,
          otp_enabled: false,
          pin_enabled: true,
          pin_code: PIN_HASH,
          pin_set_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          valid_id_path: "/Iloilo_Public_Library_Uploads/valid_ids/member_a_id.png",
          created_at: nowIso,
          last_seen: nowIso,
        },
        {
          id: 102,
          username: "member.b@example.com",
          email_display: "member.b@example.com",
          firstname: "Maria",
          lastname: "Beta",
          role: "user",
          is_active: true,
          is_approved: true,
          is_locked: false,
          lock_until: null,
          failed_attempts: 0,
          password: PASSWORD_A_HASH,
          otp_enabled: false,
          pin_enabled: true,
          pin_code: PIN_HASH,
          pin_set_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // Expired (>7d)
          valid_id_path: null,
          created_at: nowIso,
          last_seen: nowIso,
        },
      ]
    ),
    login_sessions: structuredClone(
      overrides.login_sessions ?? [
        { id: 1, user_id: 1, session_token: "tok-admin", login_at: nowIso, last_active_at: nowIso, logout_at: null },
        { id: 2, user_id: 2, session_token: "tok-lib", login_at: nowIso, last_active_at: nowIso, logout_at: null },
        { id: 3, user_id: 101, session_token: "tok-member-a", login_at: nowIso, last_active_at: nowIso, logout_at: null },
        { id: 4, user_id: 102, session_token: "tok-member-b", login_at: nowIso, last_active_at: nowIso, logout_at: null },
      ]
    ),
    system_settings: structuredClone(
      overrides.system_settings ?? [
        { id: 1, maintenance_enabled: false, lockdown_enabled: false, bypass_role: "admin" },
      ]
    ),
    books: structuredClone(
      overrides.books ?? [
        { id: 10, title: "Clean Code" },
        { id: 11, title: "Reserved Book" },
      ]
    ),
    book_copies: structuredClone(
      overrides.book_copies ?? [
        { id: 1001, book_id: 10, circulation_status: "Borrowed" },
        { id: 1002, book_id: 11, circulation_status: "Reserved" },
      ]
    ),
    library_cards: structuredClone(
      overrides.library_cards ?? [
        {
          id: 501,
          user_id: 101,
          card_type_category: "member",
          card_type: "regular",
          firstname: "Juan",
          lastname: "Alpha",
          date_issued: "2026-10-01",
          date_return: futureDate,
          valid_until: "2027-10-01",
          renewal1_checked: false,
          renewal1_date: null,
          renewal2_checked: false,
          renewal2_date: null,
          created_at: nowIso,
        },
        {
          id: 502,
          user_id: 101,
          card_type_category: "member",
          card_type: "regular",
          firstname: "Juan",
          lastname: "Alpha",
          date_issued: "2026-09-01",
          date_return: pastDate, // Overdue
          valid_until: "2027-09-01",
          renewal1_checked: false,
          renewal1_date: null,
          renewal2_checked: false,
          renewal2_date: null,
          created_at: nowIso,
        },
        {
          id: 503,
          user_id: 101,
          card_type_category: "member",
          card_type: "regular",
          firstname: "Juan",
          lastname: "Alpha",
          date_issued: "2026-10-01",
          date_return: futureDate,
          valid_until: "2027-10-01",
          renewal1_checked: true,
          renewal1_date: "2026-10-10",
          renewal2_checked: true,
          renewal2_date: "2026-10-20",
          created_at: nowIso,
        },
        {
          id: 504,
          user_id: 101,
          card_type_category: "member",
          card_type: "regular",
          firstname: "Juan",
          lastname: "Alpha",
          date_issued: "2026-10-01",
          date_return: futureDate, // Has reserved book
          valid_until: "2027-10-01",
          renewal1_checked: false,
          renewal1_date: null,
          renewal2_checked: false,
          renewal2_date: null,
          created_at: nowIso,
        },
        {
          id: 505,
          user_id: 102, // Belongs to Member B
          card_type_category: "member",
          card_type: "regular",
          firstname: "Maria",
          lastname: "Beta",
          date_issued: "2026-10-01",
          date_return: futureDate,
          valid_until: "2027-10-01",
          renewal1_checked: false,
          renewal1_date: null,
          renewal2_checked: false,
          renewal2_date: null,
          created_at: nowIso,
        },
      ]
    ),
    library_card_books: structuredClone(
      overrides.library_card_books ?? [
        { id: 601, card_id: 501, book_id: 10, copy_id: 1001, book_title: "Clean Code", book_author: "Martin", book_isbn: "123", quantity: 1, added_at: nowIso },
        { id: 604, card_id: 504, book_id: 11, copy_id: 1002, book_title: "Reserved Book", book_author: "Author", book_isbn: "456", quantity: 1, added_at: nowIso },
        { id: 605, card_id: 505, book_id: 10, copy_id: 1001, book_title: "Clean Code", book_author: "Martin", book_isbn: "123", quantity: 1, added_at: nowIso },
      ]
    ),
    book_returns: structuredClone(
      overrides.book_returns ?? [
        { id: 701, card_id: 505, return_date: "2026-10-15", created_at: nowIso },
      ]
    ),
    book_return_items: structuredClone(
      overrides.book_return_items ?? [
        { id: 801, return_id: 701, card_book_id: 605, book_title: "Clean Code", book_author: "Martin", book_isbn: "123", qty_returned: 1 },
      ]
    ),
    account_requests: structuredClone(overrides.account_requests ?? []),
    user_favorites: structuredClone(
      overrides.user_favorites ?? [
        { id: 901, user_id: 101, book_id: 10, created_at: nowIso },
        { id: 902, user_id: 102, book_id: 11, created_at: nowIso },
      ]
    ),
    user_search_history: structuredClone(
      overrides.user_search_history ?? [
        { id: 951, user_id: 101, query: "clean code", searched_at: nowIso },
        { id: 952, user_id: 102, query: "secret query b", searched_at: nowIso },
      ]
    ),
    announcements: structuredClone(
      overrides.announcements ?? [
        { id: 1, title: "Broadcast", body: "Hello all", category: "General", pinned: false, author: "Admin", target_user_id: null, created_at: nowIso },
        { id: 2, title: "For A", body: "Private A", category: "Personal", pinned: false, author: "Admin", target_user_id: 101, created_at: nowIso },
        { id: 3, title: "For B", body: "Private B", category: "Personal", pinned: false, author: "Admin", target_user_id: 102, created_at: nowIso },
      ]
    ),
    notification_reads: structuredClone(overrides.notification_reads ?? []),
    audit_logs: structuredClone(overrides.audit_logs ?? []),
    qr_login_tokens: structuredClone(overrides.qr_login_tokens ?? []),
    auth_rate_limits: structuredClone(overrides.auth_rate_limits ?? []),
  };

  let nextId = 5000;

  function applyFilters(rows, filters) {
    return rows.filter((row) =>
      filters.every((f) => {
        if (f.type === "eq") return row[f.col] === f.val;
        if (f.type === "neq") return row[f.col] !== f.val;
        if (f.type === "in") return f.vals.includes(row[f.col]);
        if (f.type === "is") return row[f.col] === f.val;
        if (f.type === "or") {
          const parts = f.expr.split(",");
          return parts.some((p) => {
            if (p.endsWith(".is.null")) {
              const col = p.replace(".is.null", "");
              return row[col] === null || row[col] === undefined;
            }
            const eqMatch = p.match(/^([^.]+)\.eq\.(.+)$/);
            if (eqMatch) {
              const col = eqMatch[1];
              const raw = eqMatch[2].replace(/^"|"$/g, "");
              return String(row[col]) === raw;
            }
            const inMatch = p.match(/^([^.]+)\.in\.\((.+)\)$/);
            if (inMatch) {
              const col = inMatch[1];
              const vals = inMatch[2].split(",").map((s) => s.replace(/^"|"$/g, ""));
              return vals.includes(String(row[col]));
            }
            return false;
          });
        }
        return true;
      })
    );
  }

  function makeQuery(table) {
    const state = {
      op: "select",
      filters: [],
      payload: null,
      options: {},
      limitVal: null,
      singleMode: null,
    };

    const q = {
      select(_cols, opts) {
        if (state.op === "select") {
          state.options = opts || {};
        }
        return q;
      },
      insert(payload) {
        state.op = "insert";
        state.payload = payload;
        return q;
      },
      update(payload) {
        state.op = "update";
        state.payload = payload;
        return q;
      },
      upsert(payload, opts) {
        state.op = "upsert";
        state.payload = payload;
        state.options = opts || {};
        return q;
      },
      delete() {
        state.op = "delete";
        return q;
      },
      eq(col, val) {
        state.filters.push({ type: "eq", col, val });
        return q;
      },
      neq(col, val) {
        state.filters.push({ type: "neq", col, val });
        return q;
      },
      in(col, vals) {
        state.filters.push({ type: "in", col, vals });
        return q;
      },
      is(col, val) {
        state.filters.push({ type: "is", col, val });
        return q;
      },
      or(expr) {
        state.filters.push({ type: "or", expr });
        return q;
      },
      order() {
        return q;
      },
      limit(n) {
        state.limitVal = n;
        return q;
      },
      single() {
        state.singleMode = "single";
        return q;
      },
      maybeSingle() {
        state.singleMode = "maybeSingle";
        return q;
      },
      then(resolve, reject) {
        try {
          const rows = db[table] ?? [];
          if (state.op === "select") {
            let matched = applyFilters(rows, state.filters);
            if (state.limitVal !== null) matched = matched.slice(0, state.limitVal);
            if (state.options.head) {
              return resolve({ data: null, count: matched.length, error: null });
            }
            if (state.singleMode === "single") {
              if (matched.length === 0) {
                return resolve({ data: null, error: { code: "PGRST116", message: "No rows" } });
              }
              return resolve({ data: structuredClone(matched[0]), error: null });
            }
            if (state.singleMode === "maybeSingle") {
              return resolve({ data: matched[0] ? structuredClone(matched[0]) : null, error: null });
            }
            return resolve({ data: structuredClone(matched), count: matched.length, error: null });
          }

          if (state.op === "insert") {
            const items = Array.isArray(state.payload) ? state.payload : [state.payload];
            const inserted = items.map((item) => {
              const row = { id: ++nextId, ...structuredClone(item) };
              db[table].push(row);
              return row;
            });
            if (state.singleMode === "single") {
              return resolve({ data: structuredClone(inserted[0]), error: null });
            }
            return resolve({ data: structuredClone(inserted), error: null });
          }

          if (state.op === "upsert") {
            const items = Array.isArray(state.payload) ? state.payload : [state.payload];
            const conflictCols = String(state.options.onConflict || "id").split(",");
            for (const item of items) {
              const idx = db[table].findIndex((r) =>
                conflictCols.every((c) => r[c.trim()] === item[c.trim()])
              );
              if (idx >= 0) {
                db[table][idx] = { ...db[table][idx], ...structuredClone(item) };
              } else {
                db[table].push({ id: ++nextId, ...structuredClone(item) });
              }
            }
            return resolve({ data: null, error: null });
          }

          if (state.op === "update") {
            const matched = applyFilters(rows, state.filters);
            for (const r of matched) {
              Object.assign(r, structuredClone(state.payload));
            }
            return resolve({ data: structuredClone(matched), error: null });
          }

          if (state.op === "delete") {
            const toDelete = new Set(applyFilters(rows, state.filters));
            db[table] = rows.filter((r) => !toDelete.has(r));
            return resolve({ data: null, error: null });
          }

          return resolve({ data: null, error: null });
        } catch (err) {
          return reject(err);
        }
      },
    };

    return q;
  }

  return {
    db,
    supabase: {
      from(table) {
        if (!db[table]) db[table] = [];
        return makeQuery(table);
      },
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Member Data Isolation & RBAC
// ---------------------------------------------------------------------------

test("Member A cannot see Member B's borrowed books, return history, favorites, search history, or targeted notifications", async () => {
  const { supabase } = createMemberMockDb();

  const borrowedA = await getMemberBorrowedBooks(supabase, MEMBER_A.userId, MEMBER_A.sessionToken);
  assert.ok(borrowedA.cards.every((c) => c.id !== 505), "Member A must not see Member B's card 505");

  const returnsA = await getMemberReturnHistory(supabase, MEMBER_A.userId, MEMBER_A.sessionToken);
  assert.equal(returnsA.returns.length, 0, "Member A must not see Member B's return history");

  const favA = await getMemberFavorites(supabase, MEMBER_A.userId, MEMBER_A.sessionToken);
  assert.deepEqual(favA.favoriteBookIds, [10], "Member A must only see own favorite book 10");

  const searchA = await getMemberSearchHistory(supabase, MEMBER_A.userId, MEMBER_A.sessionToken);
  assert.equal(searchA.history.length, 1);
  assert.equal(searchA.history[0].query, "clean code");

  const notifA = await getMemberNotifications(supabase, MEMBER_A.userId, MEMBER_A.sessionToken);
  const notifIds = notifA.notifications.map((n) => n.id);
  assert.ok(notifIds.includes(1) && notifIds.includes(2));
  assert.ok(!notifIds.includes(3), "Member A must not see Member B's targeted announcement");

  await assert.rejects(
    () => updateMemberNotificationState(supabase, MEMBER_A.userId, "read", 3, MEMBER_A.sessionToken),
    (err) => err.status === 404
  );
});

test("Staff (librarian/admin) get 403 Forbidden on member repository functions", async () => {
  const { supabase } = createMemberMockDb();

  await assert.rejects(
    () => getMemberBorrowedBooks(supabase, LIBRARIAN.userId, LIBRARIAN.sessionToken),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => getMemberSettings(supabase, ADMIN.userId, ADMIN.sessionToken),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => getMemberValidIdPath(supabase, LIBRARIAN),
    (err) => err.status === 403
  );
});

test("toggleMemberFavorite verifies book exists (404) and scopes delete to user_id", async () => {
  const { supabase, db } = createMemberMockDb();

  await assert.rejects(
    () => toggleMemberFavorite(supabase, MEMBER_A.userId, 99999, MEMBER_A.sessionToken),
    (err) => err.status === 404
  );

  // Removing Member A's favorite does not touch Member B's favorite
  const removed = await toggleMemberFavorite(supabase, MEMBER_A.userId, 10, MEMBER_A.sessionToken);
  assert.equal(removed.favorited, false);
  assert.equal(db.user_favorites.filter((f) => f.user_id === 102).length, 1);
});

// ---------------------------------------------------------------------------
// 2. Card Renewal Isolation & Rules
// ---------------------------------------------------------------------------

test("requestMemberCardRenewal refuses another member's card, overdue, max-2, and reserved books; can_renew aligns", async () => {
  clearRateLimitMemory();
  const { supabase } = createMemberMockDb();

  // Check can_renew alignment in getMemberBorrowedBooks
  const borrowedA = await getMemberBorrowedBooks(supabase, MEMBER_A.userId, MEMBER_A.sessionToken);
  const byId = new Map(borrowedA.cards.map((c) => [c.id, c]));
  assert.equal(byId.get(501).can_renew, true, "Active non-overdue non-reserved card should be renewable");
  assert.equal(byId.get(502).can_renew, false, "Overdue card must have can_renew=false");
  assert.equal(byId.get(503).can_renew, false, "Max-2 renewed card must have can_renew=false");
  assert.equal(byId.get(504).can_renew, false, "Card with reserved book must have can_renew=false");

  // Another member's card -> 404
  await assert.rejects(
    () => requestMemberCardRenewal(supabase, MEMBER_A, 505, "Please renew", "10.0.0.1"),
    (err) => err.status === 404
  );

  // Overdue card -> 409
  await assert.rejects(
    () => requestMemberCardRenewal(supabase, MEMBER_A, 502, "Please renew", "10.0.0.1"),
    (err) => err.status === 409
  );

  // Max 2 renewals -> 400
  await assert.rejects(
    () => requestMemberCardRenewal(supabase, MEMBER_A, 503, "Please renew", "10.0.0.1"),
    (err) => err.status === 400
  );

  // Reserved book -> 409
  await assert.rejects(
    () => requestMemberCardRenewal(supabase, MEMBER_A, 504, "Please renew", "10.0.0.1"),
    (err) => err.status === 409 && /reserved/i.test(err.message)
  );

  // Valid renewal succeeds, then duplicate pending fails with 409
  const okRes = await requestMemberCardRenewal(supabase, MEMBER_A, 501, "Need 7 more days", "10.0.0.1");
  assert.equal(okRes.ok, true);

  await assert.rejects(
    () => requestMemberCardRenewal(supabase, MEMBER_A, 501, "Duplicate", "10.0.0.1"),
    (err) => err.status === 409
  );
});

// ---------------------------------------------------------------------------
// 3. Settings Privacy, PIN Lifecycle & Rate Limits
// ---------------------------------------------------------------------------

test("getMemberSettings never leaks session_token, pin_code, or valid_id_path, and computes 7-day PIN expiry", async () => {
  const { supabase } = createMemberMockDb();

  const settingsA = await getMemberSettings(supabase, MEMBER_A.userId, MEMBER_A.sessionToken);
  assert.equal(settingsA.profile.has_pin, true);
  assert.equal(settingsA.profile.pin_expired, false);
  assert.equal(settingsA.profile.pin_valid, true);
  assert.ok(settingsA.profile.pin_days_left >= 1 && settingsA.profile.pin_days_left <= 7);
  assert.equal(settingsA.profile.pin_enabled, true);
  assert.equal(settingsA.profile.has_valid_id, true);
  assert.equal("pin_code" in settingsA.profile, false);
  assert.equal("valid_id_path" in settingsA.profile, false);
  for (const s of settingsA.loginActivity) {
    assert.equal("session_token" in s, false, "loginActivity must NEVER include session_token");
  }

  // Member B has an expired PIN (10 days old) and no valid ID
  const settingsB = await getMemberSettings(supabase, MEMBER_B.userId, MEMBER_B.sessionToken);
  assert.equal(settingsB.profile.has_pin, true);
  assert.equal(settingsB.profile.pin_expired, true);
  assert.equal(settingsB.profile.pin_valid, false);
  assert.equal(settingsB.profile.pin_days_left, 0);
  assert.equal(settingsB.profile.pin_enabled, false, "Expired PIN must report pin_enabled=false");
  assert.equal(settingsB.profile.has_valid_id, false);
});

test("set_pin validates password, hashes PIN, never logs PIN, and enforces rate limit; expired PIN blocked on toggle & verifyPinService", async () => {
  clearRateLimitMemory();
  const { supabase, db } = createMemberMockDb();

  // Expired PIN cannot be enabled via toggle_security
  await assert.rejects(
    () =>
      mutateMemberSettings(
        supabase,
        MEMBER_B,
        { action: "toggle_security", method: "pin", enabled: true },
        "10.0.0.2"
      ),
    (err) => err.status === 400 && /expired/i.test(err.message)
  );

  // Expired PIN rejected in verifyPinService
  const pendingMfaB = {
    uid: MEMBER_B.userId,
    step: "pin",
    methods: ["pin"],
    exp: Math.floor(Date.now() / 1000) + 600,
  };
  await assert.rejects(
    () => verifyPinService(supabase, pendingMfaB, { pin: "123456" }, "http://localhost:3000", "10.0.0.2"),
    (err) => err.status === 400 && /expired/i.test(err.message)
  );

  // Wrong password on set_pin -> 403
  await assert.rejects(
    () =>
      mutateMemberSettings(
        supabase,
        MEMBER_A,
        { action: "set_pin", password: "WrongPassword@1", pin: "654321", confirm: "654321" },
        "10.0.0.3"
      ),
    (err) => err.status === 403
  );

  // Correct password on set_pin succeeds and hashes PIN
  const pinRes = await mutateMemberSettings(
    supabase,
    MEMBER_A,
    { action: "set_pin", password: PASSWORD_A, pin: "654321", confirm: "654321" },
    "10.0.0.3"
  );
  assert.equal(pinRes.ok, true);
  assert.equal(pinRes.has_pin, true);
  assert.equal(pinRes.pin_enabled, true);

  const updatedA = db.users.find((u) => u.id === 101);
  assert.notEqual(updatedA.pin_code, "654321", "PIN must be hashed");
  assert.ok(await bcrypt.compare("654321", updatedA.pin_code));

  // Verify audit logs NEVER contain the plaintext PIN
  const serializedLogs = JSON.stringify(db.audit_logs);
  assert.ok(!serializedLogs.includes("654321"), "Audit log must NEVER contain plaintext PIN");

  // Rate limit triggers after 8 attempts on set_pin
  clearRateLimitMemory();
  db.auth_rate_limits = [];
  for (let i = 0; i < 8; i++) {
    await assert.rejects(
      () =>
        mutateMemberSettings(
          supabase,
          MEMBER_A,
          { action: "set_pin", password: "BadPassword@1", pin: "654321", confirm: "654321" },
          "10.0.0.99"
        ),
      (err) => err.status === 403
    );
  }
  await assert.rejects(
    () =>
      mutateMemberSettings(
        supabase,
        MEMBER_A,
        { action: "set_pin", password: PASSWORD_A, pin: "654321", confirm: "654321" },
        "10.0.0.99"
      ),
    (err) => err.status === 429
  );
});

test("change_password forbids reusing current password and strict Zod blocks privilege escalation fields", async () => {
  clearRateLimitMemory();
  const { supabase } = createMemberMockDb();

  // Reusing current password -> 400
  await assert.rejects(
    () =>
      mutateMemberSettings(
        supabase,
        MEMBER_A,
        {
          action: "change_password",
          current_password: PASSWORD_A,
          new_password: PASSWORD_A,
          confirm_password: PASSWORD_A,
        },
        "10.0.0.4"
      ),
    (err) => err.status === 400
  );

  // Strict Zod schemas reject role/status/is_approved/is_locked/unknown fields
  assert.equal(
    userSettingsMutationSchema.safeParse({
      action: "update_profile",
      firstname: "Juan",
      lastname: "Alpha",
      role: "admin",
    }).success,
    false
  );
  assert.equal(
    userSettingsMutationSchema.safeParse({
      action: "update_profile",
      firstname: "Juan",
      lastname: "Alpha",
      is_approved: true,
    }).success,
    false
  );
  assert.equal(
    userSettingsMutationSchema.safeParse({
      action: "set_pin",
      password: PASSWORD_A,
      pin: "123456",
      confirm: "654321",
    }).success,
    false
  );
  assert.equal(
    userSearchHistorySchema.safeParse({ query: "books", extra: 1 }).success,
    false
  );
  assert.equal(
    userFavoriteSchema.safeParse({ book_id: 1, user_id: 102 }).success,
    false
  );
  assert.equal(
    userRenewCardSchema.safeParse({ card_id: 501, user_id: 102 }).success,
    false
  );
  assert.equal(
    userValidIdQuerySchema.safeParse({ id: "102" }).success,
    false
  );
});

// ---------------------------------------------------------------------------
// 4. Member Valid-ID Self-View
// ---------------------------------------------------------------------------

test("getMemberValidIdPath returns only caller's own path and 404 when none", async () => {
  clearRateLimitMemory();
  const { supabase } = createMemberMockDb();

  const resA = await getMemberValidIdPath(supabase, MEMBER_A, "10.0.0.5");
  assert.equal(resA.dropboxPath, "/Iloilo_Public_Library_Uploads/valid_ids/member_a_id.png");

  // Member B has no valid_id_path -> 404
  await assert.rejects(
    () => getMemberValidIdPath(supabase, MEMBER_B, "10.0.0.5"),
    (err) => err.status === 404
  );
});

// ---------------------------------------------------------------------------
// 5. Signup Role Restriction, QR Safety, Session Revocation & Lockdown
// ---------------------------------------------------------------------------

test("registerUserAccountService blocks admin/librarian creation without DB-verified admin session", async () => {
  clearRateLimitMemory();
  const { supabase, db } = createMemberMockDb();

  const staffPayload = {
    firstname: "Evil",
    lastname: "Staff",
    email: "evil.staff@example.com",
    password: "StrongPassword@1",
    role: "admin",
  };

  // Unauthenticated -> 401
  await assert.rejects(
    () => registerUserAccountService(supabase, staffPayload, null, "10.0.0.6"),
    (err) => err.status === 401
  );

  // Member trying to create admin -> 403
  await assert.rejects(
    () => registerUserAccountService(supabase, staffPayload, MEMBER_A, "10.0.0.6"),
    (err) => err.status === 403
  );

  // Revoked admin session -> 401 via verifyRepositoryActor
  await assert.rejects(
    () =>
      registerUserAccountService(
        supabase,
        staffPayload,
        { ...ADMIN, sessionToken: "revoked-token" },
        "10.0.0.6"
      ),
    (err) => err.status === 401
  );

  // DB-verified admin succeeds
  const created = await registerUserAccountService(supabase, staffPayload, ADMIN, "10.0.0.6");
  assert.equal(created.ok, true);
  assert.equal(created.role, "admin");
  assert.ok(db.users.some((u) => u.username === "evil.staff@example.com"));
});

test("Deactivated, unapproved, locked, or revoked-session member cannot reuse old session; lockdown blocks member (503) but not admin", async () => {
  // Deactivated member -> 401
  {
    const { supabase, db } = createMemberMockDb();
    db.users.find((u) => u.id === 101).is_active = false;
    await assert.rejects(
      () => getMemberSettings(supabase, MEMBER_A.userId, MEMBER_A.sessionToken),
      (err) => err.status === 401
    );
  }

  // Unapproved member -> 401
  {
    const { supabase, db } = createMemberMockDb();
    db.users.find((u) => u.id === 101).is_approved = false;
    await assert.rejects(
      () => getMemberFavorites(supabase, MEMBER_A.userId, MEMBER_A.sessionToken),
      (err) => err.status === 401
    );
  }

  // Locked member -> 401
  {
    const { supabase, db } = createMemberMockDb();
    db.users.find((u) => u.id === 101).is_locked = true;
    await assert.rejects(
      () => getMemberSearchHistory(supabase, MEMBER_A.userId, MEMBER_A.sessionToken),
      (err) => err.status === 401
    );
  }

  // Revoked session -> 401
  {
    const { supabase, db } = createMemberMockDb();
    db.login_sessions.find((s) => s.session_token === "tok-member-a").logout_at =
      new Date().toISOString();
    await assert.rejects(
      () => addMemberSearchHistory(supabase, MEMBER_A.userId, "test", MEMBER_A.sessionToken),
      (err) => err.status === 401
    );
    await assert.rejects(
      () => clearMemberSearchHistory(supabase, MEMBER_A.userId, MEMBER_A.sessionToken),
      (err) => err.status === 401
    );
  }

  // Lockdown blocks member (503) but NOT admin
  {
    const { supabase, db } = createMemberMockDb();
    db.system_settings[0].lockdown_enabled = true;
    await assert.rejects(
      () => getMemberBorrowedBooks(supabase, MEMBER_A.userId, MEMBER_A.sessionToken),
      (err) => err.status === 503
    );
    const adminActor = await verifyRepositoryActor(
      supabase,
      ADMIN.userId,
      ["admin"],
      ADMIN.sessionToken
    );
    assert.equal(adminActor.role, "admin");
  }
});

test("consumeConfirmedQrToken rejects locked accounts without auto-unlocking and blocks members during lockdown", async () => {
  // Locked account rejected & remains locked
  {
    const { supabase, db } = createMemberMockDb();
    const u = db.users.find((x) => x.id === 101);
    u.is_locked = true;
    u.lock_until = new Date(Date.now() + 60_000).toISOString();

    const res = await consumeConfirmedQrToken(supabase, {
      id: 1,
      token: "qr-tok-1",
      user_id: 101,
      status: "confirmed",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    assert.equal(res.ok, false);
    assert.equal(u.is_locked, true, "QR login must NOT auto-unlock a locked account");
  }

  // Lockdown blocks member QR login
  {
    const { supabase, db } = createMemberMockDb();
    db.system_settings[0].lockdown_enabled = true;

    const res = await consumeConfirmedQrToken(supabase, {
      id: 2,
      token: "qr-tok-2",
      user_id: 101,
      status: "confirmed",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    assert.equal(res.ok, false);
  }
});
