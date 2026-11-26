import test from "node:test";
import assert from "node:assert/strict";
import {
  computeSplitUntilDate,
  expandEventsForRange,
  expandSingleEvent,
  MAX_OCCURRENCES_PER_REQUEST,
} from "../../src/lib/calendar/recurrence.ts";
import {
  eventCreateSchema,
  eventDeleteScopeSchema,
  eventRecurrenceSchema,
  eventRescheduleSchema,
} from "../../src/validators/events.ts";
import { mutateEvents } from "../../src/repositories/events.ts";

function makeEvent(overrides = {}) {
  return {
    id: 1,
    title: "Library Event",
    description: null,
    event_date: "2026-01-01",
    end_date: null,
    start_time: "21:00",
    end_time: "22:00",
    all_day: false,
    timezone: "Asia/Manila",
    location: "Main Hall",
    category: "general",
    audience: "all",
    cover_image: null,
    image: null,
    recurrence_freq: null,
    recurrence_interval: 1,
    recurrence_weekdays: null,
    recurrence_day_of_month: null,
    recurrence_until: null,
    recurrence_count: null,
    ...overrides,
  };
}

test("1. Weekly recurrence across a month boundary preserves Manila wall-clock time", () => {
  const ev = makeEvent({
    event_date: "2026-01-26",
    start_time: "21:00",
    recurrence_freq: "weekly",
    recurrence_interval: 1,
    recurrence_weekdays: [1, 5],
  });
  const occs = expandSingleEvent(ev, [], "2026-01-25", "2026-02-08");
  assert.deepEqual(
    occs.map((o) => o.occurrence_date),
    ["2026-01-26", "2026-01-30", "2026-02-02", "2026-02-06"]
  );
  assert.ok(occs.every((o) => o.start_time === "21:00" && o.is_recurring === true && o.master_id === 1));
});

test("2. Monthly recurrence on the 31st clamps cleanly to shorter months", () => {
  const ev = makeEvent({
    event_date: "2026-01-31",
    recurrence_freq: "monthly",
    recurrence_interval: 1,
    recurrence_day_of_month: 31,
  });
  const occs = expandSingleEvent(ev, [], "2026-01-01", "2026-05-31");
  assert.deepEqual(
    occs.map((o) => o.occurrence_date),
    ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]
  );
});

test("3. Yearly recurrence on leap day (Feb 29) clamps on non-leap years and returns on leap year", () => {
  const ev = makeEvent({
    event_date: "2024-02-29",
    recurrence_freq: "yearly",
    recurrence_interval: 1,
  });
  const occs = expandSingleEvent(ev, [], "2024-01-01", "2028-12-31");
  assert.deepEqual(
    occs.map((o) => o.occurrence_date),
    ["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]
  );
});

test("4. Exceptions support skipped and modified occurrences", () => {
  const ev = makeEvent({
    id: 42,
    event_date: "2026-03-01",
    recurrence_freq: "daily",
    recurrence_interval: 1,
  });
  const exceptions = [
    { event_id: 42, original_date: "2026-03-02", action: "skipped" },
    {
      event_id: 42,
      original_date: "2026-03-03",
      action: "modified",
      title: "Moved Session",
      start_time: "14:00",
    },
  ];
  const occs = expandSingleEvent(ev, exceptions, "2026-03-01", "2026-03-04");
  assert.deepEqual(
    occs.map((o) => ({ d: o.occurrence_date, t: o.title, s: o.start_time })),
    [
      { d: "2026-03-01", t: "Library Event", s: "21:00" },
      { d: "2026-03-03", t: "Moved Session", s: "14:00" },
      { d: "2026-03-04", t: "Library Event", s: "21:00" },
    ]
  );
});

test("5. 'This and following' splits a series without overlapping dates", () => {
  const splitDate = "2026-04-10";
  const original = makeEvent({
    id: 10,
    title: "Original Series",
    event_date: "2026-04-08",
    recurrence_freq: "daily",
    recurrence_until: computeSplitUntilDate(splitDate),
  });
  const split = makeEvent({
    id: 11,
    title: "Updated Series",
    event_date: splitDate,
    recurrence_freq: "daily",
    recurrence_until: "2026-04-12",
  });
  const { occurrences } = expandEventsForRange([original, split], [], "2026-04-08", "2026-04-12");
  assert.deepEqual(
    occurrences.map((o) => ({ id: o.master_id, d: o.occurrence_date, title: o.title })),
    [
      { id: 10, d: "2026-04-08", title: "Original Series" },
      { id: 10, d: "2026-04-09", title: "Original Series" },
      { id: 11, d: "2026-04-10", title: "Updated Series" },
      { id: 11, d: "2026-04-11", title: "Updated Series" },
      { id: 11, d: "2026-04-12", title: "Updated Series" },
    ]
  );
});

test("6. Count limit stops expansion after N occurrences", () => {
  const ev = makeEvent({
    event_date: "2026-05-01",
    recurrence_freq: "daily",
    recurrence_count: 4,
  });
  const occs = expandSingleEvent(ev, [], "2026-05-01", "2026-05-31");
  assert.equal(occs.length, 4);
  assert.equal(occs[3].occurrence_date, "2026-05-04");
});

test("7. Hard cap enforces 366 occurrences per request", () => {
  const ev = makeEvent({
    event_date: "2026-01-01",
    recurrence_freq: "daily",
  });
  const { occurrences, truncated } = expandEventsForRange([ev], [], "2026-01-01", "2028-12-31");
  assert.equal(occurrences.length, MAX_OCCURRENCES_PER_REQUEST);
  assert.equal(truncated, true);
});

test("8. Reschedule with scope='following' splits recurring series and clones reminders", async () => {
  const tables = {
    users: [{ id: 1, role: "admin", is_active: true, is_approved: true }],
    events: [
      {
        id: 10,
        title: "Weekly Book Club",
        description: "Reading group",
        event_date: "2026-06-01",
        end_date: null,
        start_time: "14:00",
        end_time: "15:00",
        all_day: false,
        timezone: "Asia/Manila",
        location: "Main Hall",
        category: "general",
        audience: "all",
        cover_image: null,
        image: null,
        recurrence_freq: "weekly",
        recurrence_interval: 1,
        recurrence_weekdays: [1],
        recurrence_day_of_month: null,
        recurrence_until: "2026-06-29",
        recurrence_count: null,
      },
    ],
    event_reminders: [
      { id: 1, event_id: 10, remind_before_minutes: 30 },
      { id: 2, event_id: 10, remind_before_minutes: 60 },
    ],
  };

  let nextId = 100;
  const mockDb = {
    from(tableName) {
      const state = { op: "select", filters: [], inFilters: [], payload: null };
      const execute = () => {
        const table = tables[tableName] ?? (tables[tableName] = []);
        if (state.op === "insert") {
          const items = Array.isArray(state.payload) ? state.payload : [state.payload];
          const created = items.map((it) => {
            const row = { id: ++nextId, ...it };
            table.push(row);
            return row;
          });
          return { data: created, error: null };
        }
        let rows = [...table];
        for (const [col, val] of state.filters) rows = rows.filter((r) => r[col] === val);
        for (const [col, vals] of state.inFilters) rows = rows.filter((r) => vals.includes(r[col]));
        if (state.op === "update") {
          for (const r of rows) Object.assign(r, state.payload);
          return { data: rows, error: null };
        }
        if (state.op === "delete") {
          const ids = new Set(rows.map((r) => r.id));
          tables[tableName] = table.filter((r) => !ids.has(r.id));
          return { data: rows, error: null };
        }
        return { data: rows, error: null };
      };
      const b = {
        select() { return b; },
        insert(p) { state.op = "insert"; state.payload = p; return b; },
        update(p) { state.op = "update"; state.payload = p; return b; },
        delete() { state.op = "delete"; return b; },
        eq(c, v) { state.filters.push([c, v]); return b; },
        in(c, v) { state.inFilters.push([c, v]); return b; },
        single() {
          const r = execute();
          const first = Array.isArray(r.data) ? r.data[0] : null;
          return Promise.resolve(first ? { data: first, error: null } : { data: null, error: { message: "Not found" } });
        },
        maybeSingle() {
          const r = execute();
          const first = Array.isArray(r.data) ? r.data[0] ?? null : null;
          return Promise.resolve({ data: first, error: null });
        },
        then(res, rej) { return Promise.resolve(execute()).then(res, rej); },
      };
      return b;
    },
  };

  const result = await mutateEvents(
    mockDb,
    { userId: 1, role: "admin", email: "admin@iloilolibrary.gov.ph" },
    "reschedule",
    10,
    {
      event_date: "2026-06-16",
      start_time: "16:00",
      end_time: "17:00",
      all_day: false,
      scope: "following",
      occurrence_date: "2026-06-15",
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.scope, "following");
  assert.equal(result.previous_master_id, 10);
  assert.equal(result.recurrence_until, "2026-06-14");
  assert.equal(tables.events.length, 2);
  assert.equal(tables.events[0].recurrence_until, "2026-06-14");
  assert.equal(tables.events[1].id, result.id);
  assert.equal(tables.events[1].event_date, "2026-06-16");
  assert.equal(tables.events[1].start_time, "16:00");
  assert.equal(tables.events[1].recurrence_freq, "weekly");

  // Cloned reminders exist on the new split master
  const splitReminders = tables.event_reminders
    .filter((r) => r.event_id === result.id)
    .map((r) => r.remind_before_minutes)
    .sort((a, b) => a - b);
  assert.deepEqual(splitReminders, [30, 60]);
});

test("9. Strict Zod enforces recurrence bounds (interval 1-12), valid scopes, and rejects unknown fields", () => {
  // Valid scopes
  for (const scope of ["this", "following", "all"]) {
    assert.equal(eventDeleteScopeSchema.safeParse({ scope }).success, true);
    assert.equal(
      eventRescheduleSchema.safeParse({ event_date: "2026-06-10", scope }).success,
      true
    );
  }
  // Invalid scopes
  assert.equal(eventDeleteScopeSchema.safeParse({ scope: "future_only" }).success, false);
  assert.equal(
    eventRescheduleSchema.safeParse({ event_date: "2026-06-10", scope: "invalid" }).success,
    false
  );

  // Recurrence interval bounds 1-12
  assert.equal(eventRecurrenceSchema.safeParse({ freq: "monthly", interval: 1 }).success, true);
  assert.equal(eventRecurrenceSchema.safeParse({ freq: "monthly", interval: 12 }).success, true);
  assert.equal(eventRecurrenceSchema.safeParse({ freq: "monthly", interval: 0 }).success, false);
  assert.equal(eventRecurrenceSchema.safeParse({ freq: "monthly", interval: 13 }).success, false);

  // Unknown field inside recurrence rejected
  assert.equal(
    eventCreateSchema.safeParse({
      title: "Recurring",
      event_date: "2026-06-01",
      recurrence: { freq: "weekly", interval: 1, badField: true },
    }).success,
    false
  );
});
