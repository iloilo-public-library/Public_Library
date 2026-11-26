import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSystemMode, enforceSystemMode } from "../../src/lib/auth/system-mode.ts";
import { isScheduledBackupDue } from "../../src/lib/jobs/backup.ts";
import {
  backupRestoreSchema,
  systemSettingsBackupSchema,
  systemSettingsLockdownSchema,
  systemSettingsScheduleSchema,
  systemSettingsUpdateSchema,
} from "../../src/validators/admin.ts";
import { mutateSystemSettings } from "../../src/repositories/system-settings.ts";

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

function createSettingsMockDb(initial = {}) {
  const db = {
    users: structuredClone(
      initial.users ?? [
        { id: 1, role: "admin", is_active: true, is_approved: true },
        { id: 2, role: "librarian", is_active: true, is_approved: true },
        { id: 3, role: "user", is_active: true, is_approved: true },
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
    login_sessions: structuredClone(
      initial.login_sessions ?? [
        { id: 10, user_id: 1, logout_at: null },
        { id: 11, user_id: 2, logout_at: null },
        { id: 12, user_id: 3, logout_at: null },
      ]
    ),
    backup_logs: structuredClone(
      initial.backup_logs ?? [
        {
          id: 50,
          backup_type: "manual",
          scope: "Supabase Full Database Snapshot",
          file_name: "supabase_backup_2026-05-01.json.gz",
          file_size_bytes: 12345,
          status: "success",
        },
      ]
    ),
    error_logs: [],
  };

  let nextId = 100;

  function from(table) {
    const state = {
      op: "select",
      filters: [],
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
          if (f.type === "is") return val === f.val;
          return true;
        })
      );

    const exec = () => {
      const list = db[table] ?? [];
      if (state.op === "select") {
        let out = applyFilters(list);
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
      if (state.op === "upsert") {
        const row = state.payload;
        const idx = list.findIndex((x) => x.id === row.id);
        if (idx >= 0) Object.assign(list[idx], row);
        else list.push(row);
        return { data: [row], error: null };
      }
      if (state.op === "update") {
        const targets = applyFilters(list);
        for (const t of targets) Object.assign(t, state.payload);
        return { data: state.singleMode ? (targets[0] ?? null) : targets, error: null };
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
      order() {
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

test("1. Lockdown blocks non-admins (librarian & user) and NEVER locks out admins", async () => {
  const lockedSettings = {
    lockdown_enabled: true,
    maintenance_enabled: false,
    bypass_role: "admin_librarian",
  };

  assert.equal(evaluateSystemMode(lockedSettings, "admin").allowed, true);
  assert.equal(evaluateSystemMode(lockedSettings, "librarian").allowed, false);
  assert.equal(evaluateSystemMode(lockedSettings, "librarian").code, "SYSTEM_LOCKDOWN");
  assert.equal(evaluateSystemMode(lockedSettings, "user").allowed, false);

  const supabase = createSettingsMockDb({
    system_settings: [{ id: 1, ...lockedSettings }],
  });
  await assert.doesNotReject(() => enforceSystemMode(supabase, "admin"));
  await assert.rejects(
    () => enforceSystemMode(supabase, "librarian"),
    (err) => err.status === 503 && err.code === "SYSTEM_LOCKDOWN"
  );
  await assert.rejects(
    () => enforceSystemMode(supabase, "user"),
    (err) => err.status === 503 && err.code === "SYSTEM_LOCKDOWN"
  );
});

test("2. Maintenance mode respects bypass_role (admin vs admin_librarian)", () => {
  const adminOnly = { maintenance_enabled: true, lockdown_enabled: false, bypass_role: "admin" };
  assert.equal(evaluateSystemMode(adminOnly, "admin").allowed, true);
  assert.equal(evaluateSystemMode(adminOnly, "librarian").allowed, false);
  assert.equal(evaluateSystemMode(adminOnly, "user").allowed, false);

  const staffAllowed = {
    maintenance_enabled: true,
    lockdown_enabled: false,
    bypass_role: "admin_librarian",
  };
  assert.equal(evaluateSystemMode(staffAllowed, "admin").allowed, true);
  assert.equal(evaluateSystemMode(staffAllowed, "librarian").allowed, true);
  assert.equal(evaluateSystemMode(staffAllowed, "user").allowed, false);
});

test("3. Activating lockdown terminates non-admin sessions while preserving admin sessions", async () => {
  const supabase = createSettingsMockDb();

  // Librarian cannot toggle lockdown -> 403
  await assert.rejects(
    () =>
      mutateSystemSettings(supabase, LIBRARIAN_SESSION, "toggle_lockdown", {
        enabled: true,
        confirm: true,
        reason: "Unauthorized attempt",
      }),
    (err) => err.status === 403
  );

  // Admin toggles lockdown with confirmation and reason
  const res = await mutateSystemSettings(supabase, ADMIN_SESSION, "toggle_lockdown", {
    enabled: true,
    confirm: true,
    reason: "Suspected credential compromise",
  });
  assert.equal(res.ok, true);
  assert.equal(supabase.db.system_settings[0].lockdown_enabled, true);

  // Admin session (user_id=1) stays open; librarian (2) and member (3) sessions terminated
  assert.equal(supabase.db.login_sessions.find((s) => s.user_id === 1).logout_at, null);
  assert.notEqual(supabase.db.login_sessions.find((s) => s.user_id === 2).logout_at, null);
  assert.notEqual(supabase.db.login_sessions.find((s) => s.user_id === 3).logout_at, null);
});

test("4. Scheduled backup idempotency respects frequency windows", () => {
  const now = new Date("2026-05-10T10:00:00+08:00");
  assert.equal(isScheduledBackupDue("off", null, now), false);
  assert.equal(isScheduledBackupDue("daily", "2026-05-10T02:00:00+08:00", now), false);
  assert.equal(isScheduledBackupDue("daily", "2026-05-09T23:00:00+08:00", now), true);
  assert.equal(isScheduledBackupDue("weekly", "2026-05-08T10:00:00+08:00", now), false);
  assert.equal(isScheduledBackupDue("weekly", "2026-05-01T10:00:00+08:00", now), true);
});

test("5. Strict system settings & backup restore schemas require confirmation & reject unknown fields", async () => {
  assert.equal(
    systemSettingsLockdownSchema.safeParse({ enabled: true, confirm: false, reason: "test" }).success,
    false
  );
  assert.equal(
    backupRestoreSchema.safeParse({ backup_log_id: 50, confirm: "YES" }).success,
    false
  );
  assert.equal(
    systemSettingsBackupSchema.safeParse({ scope: "Full", unknownField: 1 }).success,
    false
  );
  assert.equal(
    systemSettingsScheduleSchema.safeParse({ frequency: "daily", bad: true }).success,
    false
  );
  assert.equal(
    systemSettingsUpdateSchema.safeParse({ maintenance_enabled: true, unknown: 1 }).success,
    false
  );

  const supabase = createSettingsMockDb();
  const restoreRes = await mutateSystemSettings(supabase, ADMIN_SESSION, "restore_backup", {
    backup_log_id: 50,
    confirm: "RESTORE",
    reason: "Recover from accidental deletion",
  });
  assert.equal(restoreRes.ok, true);
  assert.equal(restoreRes.backup_log_id, 50);
  // Ensure no raw backup contents or tokens are returned
  assert.equal("tables" in restoreRes, false);
});
