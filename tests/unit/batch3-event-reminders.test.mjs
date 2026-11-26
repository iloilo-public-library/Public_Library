import test from "node:test";
import assert from "node:assert/strict";
import {
  dispatchDueEventReminders,
  escapeHtml,
} from "../../src/services/event-reminders.service.ts";
import { sendEmail } from "../../src/lib/email/index.ts";

function createMockSupabase(initialTables = {}) {
  const tables = {
    events: [...(initialTables.events ?? [])],
    event_reminders: [...(initialTables.event_reminders ?? [])],
    event_exceptions: [...(initialTables.event_exceptions ?? [])],
    event_reminder_log: [...(initialTables.event_reminder_log ?? [])],
    announcements: [...(initialTables.announcements ?? [])],
    users: [...(initialTables.users ?? [])],
    error_logs: [...(initialTables.error_logs ?? [])],
  };

  let nextId = 500;

  function makeBuilder(tableName) {
    const state = { op: "select", filters: [], limitCount: null, payload: null };

    const execute = () => {
      const table = tables[tableName] ?? (tables[tableName] = []);

      if (state.op === "insert") {
        const items = Array.isArray(state.payload) ? state.payload : [state.payload];
        for (const item of items) {
          if (tableName === "event_reminder_log") {
            const dup = table.find(
              (r) =>
                r.event_id === item.event_id &&
                r.occurrence_date === item.occurrence_date &&
                r.remind_before_minutes === item.remind_before_minutes
            );
            if (dup) {
              return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
            }
          }
          table.push({ id: ++nextId, ...item });
        }
        return { data: items, error: null };
      }

      let rows = [...table];
      for (const [col, val] of state.filters) {
        rows = rows.filter((r) => r[col] === val);
      }

      if (state.op === "update") {
        for (const r of rows) {
          Object.assign(r, state.payload);
        }
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
        state.payload = payload;
        return builder;
      },
      update(payload) {
        state.op = "update";
        state.payload = payload;
        return builder;
      },
      eq(col, val) {
        state.filters.push([col, val]);
        return builder;
      },
      limit(n) {
        state.limitCount = n;
        return builder;
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
      return makeBuilder(tableName);
    },
  };
}

// Fixed Manila timestamp: 2026-06-10 08:00:00 +08:00
const FIXED_NOW_MS = Date.parse("2026-06-10T08:00:00+08:00");

test("1. Idempotency: running dispatchDueEventReminders twice sends once and skips duplicate", async () => {
  const mockDb = createMockSupabase({
    events: [
      {
        id: 1,
        title: "Summer Reading Kickoff",
        description: "Open to all",
        event_date: "2026-06-10",
        end_date: null,
        start_time: "09:00",
        end_time: "11:00",
        all_day: false,
        location: "Main Hall",
        category: "general",
        audience: "all",
        recurrence_freq: null,
      },
    ],
    event_reminders: [{ event_id: 1, remind_before_minutes: 60 }],
    users: [
      { id: 20, username: "patron@example.com", email_display: "patron@example.com", role: "user", is_active: true, is_approved: true },
    ],
  });

  const sentEmails = [];
  const fakeSendEmail = async (input) => {
    sentEmails.push(input);
    return true;
  };

  // Run 1: sends reminder announcement + email
  const run1 = await dispatchDueEventReminders(mockDb, {
    nowMs: FIXED_NOW_MS,
    sendEmailsEnabled: true,
    sendEmailFn: fakeSendEmail,
  });
  assert.equal(run1.ok, true);
  assert.equal(run1.sent, 1);
  assert.equal(mockDb.tables.announcements.length, 1);
  assert.equal(mockDb.tables.event_reminder_log.length, 1);
  assert.equal(mockDb.tables.event_reminder_log[0].recipient_count, 1);
  assert.equal(sentEmails.length, 1);

  // Run 2: same window -> skipped via unique (event_id, occurrence_date, remind_before_minutes) 23505
  const run2 = await dispatchDueEventReminders(mockDb, {
    nowMs: FIXED_NOW_MS,
    sendEmailsEnabled: true,
    sendEmailFn: fakeSendEmail,
  });
  assert.equal(run2.ok, true);
  assert.equal(run2.sent, 0);
  assert.equal(mockDb.tables.announcements.length, 1);
  assert.equal(sentEmails.length, 1);
});

test("2. Audience handling: 'all' and 'members' notify members; 'staff' never sends public/member announcement or email", async () => {
  const mockDb = createMockSupabase({
    events: [
      { id: 1, title: "Public Talk", event_date: "2026-06-10", start_time: "09:00", end_time: "10:00", all_day: false, location: "Room A", category: "general", audience: "all" },
      { id: 2, title: "Member Workshop", event_date: "2026-06-10", start_time: "09:30", end_time: "10:30", all_day: false, location: "Room B", category: "workshop", audience: "members" },
      { id: 3, title: "Internal Staff Sync", event_date: "2026-06-10", start_time: "10:00", end_time: "11:00", all_day: false, location: "Office", category: "general", audience: "staff" },
    ],
    event_reminders: [
      { event_id: 1, remind_before_minutes: 30 },
      { event_id: 2, remind_before_minutes: 30 },
      { event_id: 3, remind_before_minutes: 30 },
    ],
    users: [
      { id: 20, username: "member@example.com", email_display: "member@example.com", role: "user", is_active: true, is_approved: true },
    ],
  });

  const sentEmails = [];
  const res = await dispatchDueEventReminders(mockDb, {
    nowMs: FIXED_NOW_MS,
    sendEmailsEnabled: true,
    sendEmailFn: async (input) => {
      sentEmails.push(input);
      return true;
    },
  });

  assert.equal(res.ok, true);
  assert.equal(res.sent, 3);
  // Only "all" and "members" created public/member reminder announcements
  assert.equal(mockDb.tables.announcements.length, 2);
  assert.equal(
    mockDb.tables.announcements.some((a) => a.title.includes("Internal Staff Sync")),
    false
  );
  // Only "all" and "members" triggered member emails
  assert.equal(sentEmails.length, 2);
  assert.equal(
    sentEmails.some((e) => e.subject.includes("Internal Staff Sync")),
    false
  );
});

test("3. HTML escaping: event title and location are escaped in reminder email HTML", async () => {
  assert.equal(
    escapeHtml(`<script>alert("x")</script> & 'test'`),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;test&#39;"
  );

  const mockDb = createMockSupabase({
    events: [
      {
        id: 5,
        title: `Story <img src=x onerror=alert(1)> & Fun`,
        event_date: "2026-06-10",
        start_time: "09:00",
        end_time: "10:00",
        all_day: false,
        location: `Hall "A" <2nd Floor>`,
        category: "general",
        audience: "all",
      },
    ],
    event_reminders: [{ event_id: 5, remind_before_minutes: 60 }],
    users: [
      { id: 20, username: "member@example.com", email_display: "member@example.com", role: "user", is_active: true, is_approved: true },
    ],
  });

  const sentEmails = [];
  await dispatchDueEventReminders(mockDb, {
    nowMs: FIXED_NOW_MS,
    sendEmailsEnabled: true,
    sendEmailFn: async (input) => {
      sentEmails.push(input);
      return true;
    },
  });

  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].html.includes("<img"), false);
  assert.equal(sentEmails[0].html.includes("<2nd Floor>"), false);
  assert.ok(sentEmails[0].html.includes("&lt;img src=x onerror=alert(1)&gt; &amp; Fun"));
  assert.ok(sentEmails[0].html.includes("Hall &quot;A&quot; &lt;2nd Floor&gt;"));
});

test("4. No PII in email failure logs when Resend fails or throws", async () => {
  const prevKey = process.env.RESEND_API_KEY;
  const origFetch = globalThis.fetch;
  const origError = console.error;
  const origLog = console.log;
  const captured = [];

  try {
    process.env.RESEND_API_KEY = "re_test_dummy_key";
    console.error = (...args) => captured.push(args.join(" "));
    console.log = (...args) => captured.push(args.join(" "));

    // Case A: Resend returns 500 error
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      text: async () => "Internal provider error",
    });

    const ok1 = await sendEmail({
      to: "sensitive.patron.pii@example.com",
      subject: "Reminder: Book Fair",
      html: "<p>Reminder</p>",
    });
    assert.equal(ok1, false);

    // Case B: fetch throws network error
    globalThis.fetch = async () => {
      throw new Error("Network timeout");
    };

    const ok2 = await sendEmail({
      to: "another.secret.user@example.com",
      subject: "Reminder: Book Fair",
      html: "<p>Reminder</p>",
    });
    assert.equal(ok2, false);

    const allLogs = captured.join("\n");
    assert.equal(allLogs.includes("sensitive.patron.pii@example.com"), false);
    assert.equal(allLogs.includes("another.secret.user@example.com"), false);
  } finally {
    globalThis.fetch = origFetch;
    console.error = origError;
    console.log = origLog;
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
  }
});
