import test from "node:test";
import assert from "node:assert/strict";
import {
  announcementCreateSchema,
  announcementUpdateSchema,
  adminUsersQuerySchema,
} from "../../src/validators/admin.ts";
import { userNotificationActionSchema } from "../../src/validators/user.ts";
import {
  mutateAnnouncements,
  queryAnnouncements,
} from "../../src/repositories/announcements.ts";
import {
  getMemberNotifications,
  updateMemberNotificationState,
} from "../../src/repositories/member.ts";
import { queryAdminUsers } from "../../src/repositories/users.ts";
import { executeAdminMutation } from "../../src/services/admin.service.ts";
import { AdminMutationError } from "../../src/repositories/shared.ts";

/**
 * Lightweight in-memory Supabase mock supporting chaining for announcements,
 * users, library_cards, notification_reads, and error_logs.
 */
function createMockSupabase(initialTables = {}) {
  const tables = {
    users: [...(initialTables.users ?? [])],
    announcements: [...(initialTables.announcements ?? [])],
    notification_reads: [...(initialTables.notification_reads ?? [])],
    library_cards: [...(initialTables.library_cards ?? [])],
    error_logs: [...(initialTables.error_logs ?? [])],
  };

  let nextId = 1000;

  function applyOrFilter(rows, expr) {
    const clauses = expr.split(",").map((s) => s.trim());
    return rows.filter((row) =>
      clauses.some((clause) => {
        if (clause.endsWith(".is.null")) {
          const col = clause.slice(0, -".is.null".length);
          return row[col] === null || row[col] === undefined;
        }
        const eqIdx = clause.indexOf(".eq.");
        if (eqIdx !== -1) {
          const col = clause.slice(0, eqIdx);
          const val = clause.slice(eqIdx + 4);
          return String(row[col]) === String(val);
        }
        const ilikeIdx = clause.indexOf(".ilike.");
        if (ilikeIdx !== -1) {
          const col = clause.slice(0, ilikeIdx);
          const pattern = clause.slice(ilikeIdx + 7).replace(/%/g, "").toLowerCase();
          return String(row[col] ?? "").toLowerCase().includes(pattern);
        }
        return false;
      })
    );
  }

  function makeQueryBuilder(tableName) {
    const state = {
      op: "select",
      filters: [],
      inFilters: [],
      isFilters: [],
      orExpr: null,
      limitCount: null,
      insertPayload: null,
      updatePayload: null,
      upsertPayload: null,
    };

    const execute = () => {
      const table = tables[tableName] ?? (tables[tableName] = []);

      if (state.op === "insert") {
        const items = Array.isArray(state.insertPayload)
          ? state.insertPayload
          : [state.insertPayload];
        const inserted = items.map((item) => {
          const row = { id: item.id ?? ++nextId, created_at: new Date().toISOString(), ...item };
          table.push(row);
          return row;
        });
        return { data: inserted, error: null };
      }

      if (state.op === "upsert") {
        const items = Array.isArray(state.upsertPayload)
          ? state.upsertPayload
          : [state.upsertPayload];
        for (const item of items) {
          const existingIdx = table.findIndex(
            (r) =>
              r.user_id === item.user_id &&
              r.announcement_id === item.announcement_id
          );
          if (existingIdx >= 0) {
            table[existingIdx] = { ...table[existingIdx], ...item };
          } else {
            table.push({ id: ++nextId, ...item });
          }
        }
        return { data: items, error: null };
      }

      let rows = [...table];
      for (const [col, val] of state.filters) {
        rows = rows.filter((r) => r[col] === val);
      }
      for (const [col, vals] of state.inFilters) {
        rows = rows.filter((r) => vals.includes(r[col]));
      }
      for (const [col, val] of state.isFilters) {
        rows = rows.filter((r) => (val === null ? r[col] === null || r[col] === undefined : r[col] === val));
      }
      if (state.orExpr) {
        rows = applyOrFilter(rows, state.orExpr);
      }

      if (state.op === "update") {
        for (const r of rows) {
          Object.assign(r, state.updatePayload);
        }
        return { data: rows, error: null };
      }

      if (state.op === "delete") {
        const idsToRemove = new Set(rows.map((r) => r.id));
        tables[tableName] = table.filter((r) => !idsToRemove.has(r.id));
        return { data: rows, error: null };
      }

      if (state.limitCount !== null) {
        rows = rows.slice(0, state.limitCount);
      }

      return { data: rows, error: null };
    };

    const builder = {
      select() {
        return builder;
      },
      insert(payload) {
        state.op = "insert";
        state.insertPayload = payload;
        return builder;
      },
      update(payload) {
        state.op = "update";
        state.updatePayload = payload;
        return builder;
      },
      upsert(payload) {
        state.op = "upsert";
        state.upsertPayload = payload;
        return builder;
      },
      delete() {
        state.op = "delete";
        return builder;
      },
      eq(col, val) {
        state.filters.push([col, val]);
        return builder;
      },
      in(col, vals) {
        state.inFilters.push([col, vals]);
        return builder;
      },
      is(col, val) {
        state.isFilters.push([col, val]);
        return builder;
      },
      or(expr) {
        state.orExpr = expr;
        return builder;
      },
      order() {
        return builder;
      },
      limit(n) {
        state.limitCount = n;
        return builder;
      },
      single() {
        const res = execute();
        const first = Array.isArray(res.data) ? res.data[0] : res.data;
        if (!first) {
          return Promise.resolve({ data: null, error: { message: "Not found" } });
        }
        return Promise.resolve({ data: first, error: null });
      },
      maybeSingle() {
        const res = execute();
        const first = Array.isArray(res.data) ? res.data[0] ?? null : res.data ?? null;
        return Promise.resolve({ data: first, error: null });
      },
      then(resolve, reject) {
        return Promise.resolve(execute()).then(resolve, reject);
      },
    };

    return builder;
  }

  return {
    tables,
    from(tableName) {
      return makeQueryBuilder(tableName);
    },
  };
}

const STAFF_SESSION = {
  userId: 1,
  role: "admin",
  email: "admin@iloilolibrary.gov.ph",
};

test("1. Validator: announcementCreateSchema accepts optional target_user_id and rejects invalid ids & unknown fields", () => {
  const broadcast = announcementCreateSchema.safeParse({
    title: "Library Hours",
    body: "Open until 6 PM",
  });
  assert.equal(broadcast.success, true);
  assert.equal(broadcast.data.target_user_id, null);

  const targetedNum = announcementCreateSchema.safeParse({
    title: "Overdue Notice",
    body: "Please return your book.",
    target_user_id: 42,
  });
  assert.equal(targetedNum.success, true);
  assert.equal(targetedNum.data.target_user_id, 42);

  const targetedStr = announcementCreateSchema.safeParse({
    title: "Overdue Notice",
    body: "Please return your book.",
    target_user_id: "42",
  });
  assert.equal(targetedStr.success, true);
  assert.equal(targetedStr.data.target_user_id, 42);

  const emptyStr = announcementCreateSchema.safeParse({
    title: "General",
    body: "Broadcast",
    target_user_id: "",
  });
  assert.equal(emptyStr.success, true);
  assert.equal(emptyStr.data.target_user_id, null);

  assert.equal(
    announcementCreateSchema.safeParse({
      title: "Bad",
      body: "Body",
      target_user_id: 0,
    }).success,
    false
  );
  assert.equal(
    announcementCreateSchema.safeParse({
      title: "Bad",
      body: "Body",
      target_user_id: -5,
    }).success,
    false
  );
  assert.equal(
    announcementCreateSchema.safeParse({
      title: "Bad",
      body: "Body",
      target_user_id: "abc",
    }).success,
    false
  );
  assert.equal(
    announcementCreateSchema.safeParse({
      title: "Bad",
      body: "Body",
      extra_field: true,
    }).success,
    false
  );
});

test("2. Validator: announcementUpdateSchema rejects target_user_id and unknown fields", () => {
  const validUpdate = announcementUpdateSchema.safeParse({
    title: "Updated Title",
    body: "Updated Body",
    category: "urgent",
    pinned: true,
  });
  assert.equal(validUpdate.success, true);

  const withRecipient = announcementUpdateSchema.safeParse({
    title: "Updated Title",
    body: "Updated Body",
    target_user_id: 42,
  });
  assert.equal(withRecipient.success, false);

  const withUnknown = announcementUpdateSchema.safeParse({
    title: "Updated Title",
    body: "Updated Body",
    unexpected: "nope",
  });
  assert.equal(withUnknown.success, false);
});

test("3. Validator: userNotificationActionSchema rejects unknown fields and invalid announcement_id", () => {
  assert.equal(
    userNotificationActionSchema.safeParse({ action: "read_all" }).success,
    true
  );
  assert.equal(
    userNotificationActionSchema.safeParse({ action: "read", announcement_id: 10 }).success,
    true
  );
  assert.equal(
    userNotificationActionSchema.safeParse({
      action: "read_all",
      extra: true,
    }).success,
    false
  );
  assert.equal(
    userNotificationActionSchema.safeParse({
      action: "dismiss",
      announcement_id: 10,
      target_user_id: 99,
    }).success,
    false
  );
  assert.equal(
    userNotificationActionSchema.safeParse({
      action: "read",
      announcement_id: -1,
    }).success,
    false
  );
});

test("4. Active-member enforcement on targeted announcement create", async () => {
  const mockDb = createMockSupabase({
    users: [
      { id: 1, firstname: "Admin", lastname: "Staff", role: "admin", is_active: true, is_approved: true },
      { id: 10, firstname: "Juan", lastname: "Dela Cruz", role: "user", is_active: true, is_approved: true },
      { id: 11, firstname: "Inactive", lastname: "Member", role: "user", is_active: false, is_approved: true },
      { id: 12, firstname: "Pending", lastname: "Member", role: "user", is_active: true, is_approved: false },
      { id: 13, firstname: "Lib", lastname: "Staff", role: "librarian", is_active: true, is_approved: true },
    ],
  });

  // Valid active+approved member succeeds
  const created = await mutateAnnouncements(mockDb, STAFF_SESSION, "create", null, {
    title: "Hold Ready",
    body: "Your reserved book is ready for pickup.",
    target_user_id: 10,
  });
  assert.equal(created.ok, true);
  assert.equal(created.target_user_id, 10);
  assert.equal(created.target_user_name, "Juan Dela Cruz");

  // Inactive member rejected
  await assert.rejects(
    () =>
      mutateAnnouncements(mockDb, STAFF_SESSION, "create", null, {
        title: "Notice",
        body: "Body",
        target_user_id: 11,
      }),
    (err) => err instanceof AdminMutationError && err.status === 400
  );

  // Unapproved member rejected
  await assert.rejects(
    () =>
      mutateAnnouncements(mockDb, STAFF_SESSION, "create", null, {
        title: "Notice",
        body: "Body",
        target_user_id: 12,
      }),
    (err) => err instanceof AdminMutationError && err.status === 400
  );

  // Non-member (librarian) rejected
  await assert.rejects(
    () =>
      mutateAnnouncements(mockDb, STAFF_SESSION, "create", null, {
        title: "Notice",
        body: "Body",
        target_user_id: 13,
      }),
    (err) => err instanceof AdminMutationError && err.status === 400
  );

  // Missing user rejected
  await assert.rejects(
    () =>
      mutateAnnouncements(mockDb, STAFF_SESSION, "create", null, {
        title: "Notice",
        body: "Body",
        target_user_id: 9999,
      }),
    (err) => err instanceof AdminMutationError && err.status === 400
  );
});

test("5. Privacy: member A cannot read or mutate member B's targeted announcement", async () => {
  const mockDb = createMockSupabase({
    announcements: [
      { id: 101, title: "Broadcast", body: "For all", category: "general", pinned: false, author: "Staff", target_user_id: null },
      { id: 102, title: "For Member A", body: "Private A", category: "reminder", pinned: false, author: "Staff", target_user_id: 20 },
      { id: 103, title: "For Member B", body: "Private B", category: "reminder", pinned: false, author: "Staff", target_user_id: 21 },
    ],
  });

  // Member A notifications include broadcast (101) and own targeted (102), NEVER member B's (103)
  const notifA = await getMemberNotifications(mockDb, 20);
  const idsA = notifA.notifications.map((n) => n.id);
  assert.deepEqual(idsA.sort(), [101, 102]);

  // Public / non-staff queryAnnouncements (sessionUserId = null) returns ONLY broadcast (101)
  const publicFeed = await queryAnnouncements(mockDb, null);
  assert.deepEqual(
    publicFeed.rows.map((r) => r.id),
    [101]
  );

  // Member A can mark own targeted announcement (102) as read
  const markOwn = await updateMemberNotificationState(mockDb, 20, "read", 102);
  assert.equal(markOwn.ok, true);

  // Member A CANNOT read or dismiss Member B's targeted announcement (103)
  await assert.rejects(
    () => updateMemberNotificationState(mockDb, 20, "read", 103),
    (err) => err instanceof AdminMutationError && err.status === 404
  );
  await assert.rejects(
    () => updateMemberNotificationState(mockDb, 20, "dismiss", 103),
    (err) => err instanceof AdminMutationError && err.status === 404
  );
});

test("6. Admin list exposes target_user_id and target_user_name only (never email/phone)", async () => {
  const mockDb = createMockSupabase({
    users: [
      { id: 1, role: "admin", is_active: true, is_approved: true },
      {
        id: 20,
        firstname: "Maria",
        lastname: "Clara",
        email_display: "maria.clara@secret.example.com",
        username: "maria.clara@secret.example.com",
        phone_number: "+639171234567",
        role: "user",
        is_active: true,
        is_approved: true,
      },
    ],
    announcements: [
      { id: 201, title: "Broadcast", body: "All", category: "general", pinned: false, author: "Staff", target_user_id: null },
      { id: 202, title: "Direct", body: "Hi", category: "reminder", pinned: false, author: "Staff", target_user_id: 20 },
    ],
  });

  const res = await queryAnnouncements(mockDb, 1);
  assert.equal(res.rows.length, 2);

  const direct = res.rows.find((r) => r.id === 202);
  assert.equal(direct.target_user_id, 20);
  assert.equal(direct.target_user_name, "Maria Clara");

  const serialized = JSON.stringify(res.rows);
  assert.equal(serialized.includes("maria.clara@secret.example.com"), false);
  assert.equal(serialized.includes("+639171234567"), false);
  assert.equal("email" in direct, false);
  assert.equal("phone_number" in direct, false);
});

test("7. Picker mode returns only allowed fields for active approved members", async () => {
  const mockDb = createMockSupabase({
    users: [
      { id: 1, firstname: "Admin", lastname: "User", role: "admin", is_active: true, is_approved: true },
      {
        id: 30,
        firstname: "Jose",
        lastname: "Rizal",
        email_display: "jose@secret.example.com",
        username: "jose@secret.example.com",
        phone_number: "+639180001111",
        role: "user",
        is_active: true,
        is_approved: true,
      },
      {
        id: 31,
        firstname: "Inactive",
        lastname: "User",
        email_display: "inactive@example.com",
        role: "user",
        is_active: false,
        is_approved: true,
      },
    ],
    library_cards: [{ id: 55, user_id: 30 }],
  });

  const parsed = adminUsersQuerySchema.parse({ mode: "picker", q: "Jose", limit: 8 });
  const result = await queryAdminUsers(mockDb, STAFF_SESSION, parsed);

  assert.equal(result.ok, true);
  assert.equal(result.users.length, 1);

  const member = result.users[0];
  assert.deepEqual(Object.keys(member).sort(), [
    "firstname",
    "fullname",
    "id",
    "is_active",
    "is_approved",
    "lastname",
    "library_card_number",
  ]);
  assert.equal(member.id, 30);
  assert.equal(member.fullname, "Jose Rizal");
  assert.equal(member.library_card_number, "LC-000055");
  assert.equal(JSON.stringify(result).includes("jose@secret.example.com"), false);
  assert.equal(JSON.stringify(result).includes("+639180001111"), false);
});

test("8. Audit logging includes target_user_id on targeted create without logging PII", async () => {
  const mockDb = createMockSupabase({
    users: [
      { id: 1, firstname: "Admin", lastname: "Staff", role: "admin", is_active: true, is_approved: true },
      {
        id: 40,
        firstname: "Private",
        lastname: "Patron",
        email_display: "patron.pii@example.com",
        role: "user",
        is_active: true,
        is_approved: true,
      },
    ],
  });

  const result = await executeAdminMutation(mockDb, STAFF_SESSION, {
    resource: "announcements",
    action: "create",
    id: null,
    payload: {
      title: "Private Notice",
      body: "Please check your account.",
      target_user_id: 40,
    },
    method: "POST",
  });

  assert.equal(result.ok, true);
  assert.equal(mockDb.tables.error_logs.length, 1);

  const auditRow = mockDb.tables.error_logs[0];
  assert.ok(String(auditRow.details).includes("target_user_id=40"));
  assert.equal(auditRow.user_email, "user#1");
  assert.equal(JSON.stringify(auditRow).includes("patron.pii@example.com"), false);
  assert.equal(JSON.stringify(auditRow).includes("admin@iloilolibrary.gov.ph"), false);
  assert.equal(JSON.stringify(auditRow).includes("Private Patron"), false);
});
