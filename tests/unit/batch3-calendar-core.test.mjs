import test from "node:test";
import assert from "node:assert/strict";
import {
  eventCreateSchema,
  eventUpdateSchema,
  eventRescheduleSchema,
  eventDeleteScopeSchema,
  eventQueryRangeSchema,
  eventCategoryCreateSchema,
  eventCategoryUpdateSchema,
} from "../../src/validators/events.ts";
import {
  queryEvents,
  mutateEvents,
  mutateEventCategories,
} from "../../src/repositories/events.ts";
import { AdminMutationError } from "../../src/repositories/shared.ts";
import { ForbiddenError } from "../../src/lib/errors.ts";
import {
  detectImageSignature,
  readImageDimensions,
  stripImageMetadata,
  MAX_EVENT_COVER_WIDTH,
} from "../../src/lib/storage/index.ts";

function createMockSupabase(initialTables = {}) {
  const tables = {
    users: [...(initialTables.users ?? [])],
    events: [...(initialTables.events ?? [])],
    event_categories: [...(initialTables.event_categories ?? [])],
    event_exceptions: [...(initialTables.event_exceptions ?? [])],
    event_reminders: [...(initialTables.event_reminders ?? [])],
  };

  function makeBuilder(tableName) {
    const state = {
      op: "select",
      selectOptions: null,
      filters: [],
      inFilters: [],
    };

    const execute = () => {
      const table = tables[tableName] ?? (tables[tableName] = []);
      let rows = [...table];
      for (const [col, val] of state.filters) {
        rows = rows.filter((r) => r[col] === val);
      }
      for (const [col, vals] of state.inFilters) {
        rows = rows.filter((r) => vals.includes(r[col]));
      }
      if (state.op === "delete") {
        const ids = new Set(rows.map((r) => r.id));
        tables[tableName] = table.filter((r) => !ids.has(r.id));
        return { data: rows, error: null };
      }
      if (state.selectOptions?.head && state.selectOptions?.count === "exact") {
        return { data: null, count: rows.length, error: null };
      }
      return { data: rows, count: rows.length, error: null };
    };

    const builder = {
      select(_cols, opts) {
        state.selectOptions = opts ?? null;
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
      order() {
        return builder;
      },
      single() {
        const res = execute();
        const first = Array.isArray(res.data) ? res.data[0] : null;
        return Promise.resolve(first ? { data: first, error: null } : { data: null, error: { message: "Not found" } });
      },
      maybeSingle() {
        const res = execute();
        const first = Array.isArray(res.data) ? res.data[0] ?? null : null;
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
    from(name) {
      return makeBuilder(name);
    },
  };
}

/** Synthetic minimal valid binary image builders for unit tests */
function makeSyntheticPng(width, height, withMetadata = false) {
  const sig = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const makeChunk = (type, data) => {
    const out = new Uint8Array(12 + data.length);
    const len = data.length;
    out[0] = (len >>> 24) & 0xff;
    out[1] = (len >>> 16) & 0xff;
    out[2] = (len >>> 8) & 0xff;
    out[3] = len & 0xff;
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    return out;
  };
  const ihdrData = new Uint8Array(13);
  ihdrData[0] = (width >>> 24) & 0xff;
  ihdrData[1] = (width >>> 16) & 0xff;
  ihdrData[2] = (width >>> 8) & 0xff;
  ihdrData[3] = width & 0xff;
  ihdrData[4] = (height >>> 24) & 0xff;
  ihdrData[5] = (height >>> 16) & 0xff;
  ihdrData[6] = (height >>> 8) & 0xff;
  ihdrData[7] = height & 0xff;

  const parts = [sig, makeChunk("IHDR", ihdrData)];
  if (withMetadata) {
    parts.push(makeChunk("tEXt", new TextEncoder().encode("Author\0Secret Camera")));
    parts.push(makeChunk("eXIf", new TextEncoder().encode("GPS:10.7202,122.5621")));
  }
  parts.push(makeChunk("IEND", new Uint8Array(0)));
  const total = parts.reduce((s, p) => s + p.length, 0);
  const res = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    res.set(p, off);
    off += p.length;
  }
  return res;
}

function makeSyntheticJpeg(width, height, withExif = false) {
  const parts = [Uint8Array.from([0xff, 0xd8])];
  if (withExif) {
    const exifPayload = new TextEncoder().encode("Exif\0\0GPS_SECRET");
    const segLen = exifPayload.length + 2;
    const app1 = new Uint8Array(2 + segLen);
    app1[0] = 0xff;
    app1[1] = 0xe1;
    app1[2] = (segLen >>> 8) & 0xff;
    app1[3] = segLen & 0xff;
    app1.set(exifPayload, 4);
    parts.push(app1);
  }
  // SOF0 segment: FF C0, len=11 (0x00 0x0B), precision=8, height(2), width(2), components=1, compData(3)
  const sof0 = Uint8Array.from([
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >>> 8) & 0xff, height & 0xff,
    (width >>> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
  ]);
  parts.push(sof0);
  parts.push(Uint8Array.from([0xff, 0xd9]));
  const total = parts.reduce((s, p) => s + p.length, 0);
  const res = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    res.set(p, off);
    off += p.length;
  }
  return res;
}

function makeSyntheticWebpVp8x(width, height, withExifXmp = false) {
  const makeChunk = (fourcc, payload) => {
    const pad = payload.length & 1;
    const out = new Uint8Array(8 + payload.length + pad);
    for (let i = 0; i < 4; i++) out[i] = fourcc.charCodeAt(i);
    const len = payload.length;
    out[4] = len & 0xff;
    out[5] = (len >>> 8) & 0xff;
    out[6] = (len >>> 16) & 0xff;
    out[7] = (len >>> 24) & 0xff;
    out.set(payload, 8);
    return out;
  };
  const vp8xPayload = new Uint8Array(10);
  vp8xPayload[0] = withExifXmp ? 0x0c : 0x00; // EXIF + XMP flags
  const wMinus1 = width - 1;
  const hMinus1 = height - 1;
  vp8xPayload[4] = wMinus1 & 0xff;
  vp8xPayload[5] = (wMinus1 >>> 8) & 0xff;
  vp8xPayload[6] = (wMinus1 >>> 16) & 0xff;
  vp8xPayload[7] = hMinus1 & 0xff;
  vp8xPayload[8] = (hMinus1 >>> 8) & 0xff;
  vp8xPayload[9] = (hMinus1 >>> 16) & 0xff;

  const chunks = [makeChunk("VP8X", vp8xPayload), makeChunk("VP8 ", new Uint8Array(4))];
  if (withExifXmp) {
    chunks.push(makeChunk("EXIF", new TextEncoder().encode("SECRET_EXIF")));
    chunks.push(makeChunk("XMP ", new TextEncoder().encode("<xmp>SECRET_XMP</xmp>")));
  }
  const payloadLen = 4 + chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(8 + payloadLen);
  out.set(new TextEncoder().encode("RIFF"), 0);
  out[4] = payloadLen & 0xff;
  out[5] = (payloadLen >>> 8) & 0xff;
  out[6] = (payloadLen >>> 16) & 0xff;
  out[7] = (payloadLen >>> 24) & 0xff;
  out.set(new TextEncoder().encode("WEBP"), 8);
  let off = 12;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

test("1. Strict Zod: event, reschedule, delete, range, and category schemas reject unknown fields & end < start", () => {
  assert.equal(
    eventCreateSchema.safeParse({
      title: "Book Fair",
      event_date: "2026-05-10",
      end_date: "2026-05-09",
    }).success,
    false
  );

  assert.equal(
    eventCreateSchema.safeParse({
      title: "Book Fair",
      event_date: "2026-05-10",
      start_time: "15:00",
      end_time: "14:00",
    }).success,
    false
  );

  assert.equal(
    eventCreateSchema.safeParse({
      title: "Book Fair",
      event_date: "2026-05-10",
      unknownField: true,
    }).success,
    false
  );

  assert.equal(
    eventUpdateSchema.safeParse({
      title: "Book Fair",
      event_date: "2026-05-10",
      recurrence: { freq: "weekly", unknownRec: 1 },
    }).success,
    false
  );

  assert.equal(
    eventRescheduleSchema.safeParse({
      event_date: "2026-05-10",
      extraField: "bad",
    }).success,
    false
  );

  assert.equal(
    eventDeleteScopeSchema.safeParse({
      scope: "all",
      extraField: "bad",
    }).success,
    false
  );

  assert.equal(
    eventQueryRangeSchema.safeParse({
      from: "2026-05-01",
      to: "2026-05-10",
      extra: 1,
    }).success,
    false
  );

  assert.equal(
    eventCategoryCreateSchema.safeParse({
      slug: "kids",
      name: "Kids Corner",
      color: "#48c78e",
      is_system: true,
    }).success,
    false
  );

  assert.equal(
    eventCategoryUpdateSchema.safeParse({
      name: "Updated",
      slug: "cannot-change",
    }).success,
    false
  );
});

test("2. Audience enforcement in queryEvents: guest vs member vs staff", async () => {
  const mockDb = createMockSupabase({
    events: [
      { id: 1, title: "Public Event", event_date: "2026-05-10", audience: "all", category: "general" },
      { id: 2, title: "Members Only", event_date: "2026-05-11", audience: "members", category: "workshop" },
      { id: 3, title: "Staff Briefing", event_date: "2026-05-12", audience: "staff", category: "general" },
    ],
  });

  // Unauthenticated guest: sees ONLY audience === "all"
  const guestRes = await queryEvents(mockDb, { isStaff: false, sessionRole: null });
  assert.deepEqual(
    guestRes.rows.map((r) => r.id),
    [1]
  );

  // Authenticated member: sees "all" and "members", NEVER "staff"
  const memberRes = await queryEvents(mockDb, { isStaff: false, sessionRole: "user" });
  assert.deepEqual(
    memberRes.rows.map((r) => r.id),
    [1, 2]
  );

  // Staff (librarian / admin): sees all three
  const staffRes = await queryEvents(mockDb, { isStaff: true, sessionRole: "librarian" });
  assert.deepEqual(
    staffRes.rows.map((r) => r.id),
    [1, 2, 3]
  );
});

test("3. Repository RBAC & category protection: rejects non-admin category writes and deleting system/in-use categories", async () => {
  const mockDb = createMockSupabase({
    users: [
      { id: 1, role: "admin", is_active: true, is_approved: true },
      { id: 2, role: "librarian", is_active: true, is_approved: true },
      { id: 3, role: "user", is_active: true, is_approved: true },
    ],
    event_categories: [
      { id: 1, slug: "general", name: "General", color: "#48c78e", is_system: true },
      { id: 10, slug: "book_club", name: "Book Club", color: "#3b82f6", is_system: false },
    ],
    events: [
      { id: 50, title: "May Club", event_date: "2026-05-15", category: "book_club", audience: "all" },
    ],
  });

  // Member blocked at repository level from mutating events
  await assert.rejects(
    () =>
      mutateEvents(mockDb, { userId: 3, role: "user", email: "m@example.com" }, "create", null, {
        title: "Hack",
        event_date: "2026-05-20",
      }),
    (err) => err instanceof ForbiddenError
  );

  // Librarian blocked at repository level from mutating event_categories
  await assert.rejects(
    () =>
      mutateEventCategories(
        mockDb,
        { userId: 2, role: "librarian", email: "l@example.com" },
        "create",
        null,
        { slug: "poetry", name: "Poetry", color: "#112233" }
      ),
    (err) => err instanceof ForbiddenError
  );

  // Admin cannot delete built-in system category (409)
  await assert.rejects(
    () =>
      mutateEventCategories(
        mockDb,
        { userId: 1, role: "admin", email: "a@example.com" },
        "delete",
        1,
        {}
      ),
    (err) => err instanceof AdminMutationError && err.status === 409
  );

  // Admin cannot delete custom category still in use by an event (409)
  await assert.rejects(
    () =>
      mutateEventCategories(
        mockDb,
        { userId: 1, role: "admin", email: "a@example.com" },
        "delete",
        10,
        {}
      ),
    (err) => err instanceof AdminMutationError && err.status === 409
  );
});

test("4. Image magic bytes, 1600px width header parsing, and JPEG/PNG/WebP metadata stripping", () => {
  // Rejects fake image bytes
  assert.equal(detectImageSignature(new TextEncoder().encode("not an image at all")), null);

  // PNG: signature, dimensions, >1600px detection, and eXIf/tEXt stripping
  const pngOk = makeSyntheticPng(1200, 630, true);
  assert.equal(detectImageSignature(pngOk), "png");
  assert.deepEqual(readImageDimensions(pngOk, "png"), { width: 1200, height: 630 });
  const strippedPng = stripImageMetadata(pngOk, "png");
  const strippedPngStr = new TextDecoder().decode(strippedPng);
  assert.equal(strippedPngStr.includes("Secret Camera"), false);
  assert.equal(strippedPngStr.includes("GPS:10.7202"), false);
  assert.deepEqual(readImageDimensions(strippedPng, "png"), { width: 1200, height: 630 });

  const pngTooWide = makeSyntheticPng(MAX_EVENT_COVER_WIDTH + 1, 900);
  assert.equal(readImageDimensions(pngTooWide, "png").width, 1601);

  // JPEG: signature, SOF0 dimensions, and APP1 EXIF stripping
  const jpgOk = makeSyntheticJpeg(1600, 900, true);
  assert.equal(detectImageSignature(jpgOk), "jpeg");
  assert.deepEqual(readImageDimensions(jpgOk, "jpeg"), { width: 1600, height: 900 });
  const strippedJpg = stripImageMetadata(jpgOk, "jpeg");
  assert.equal(new TextDecoder().decode(strippedJpg).includes("GPS_SECRET"), false);
  assert.deepEqual(readImageDimensions(strippedJpg, "jpeg"), { width: 1600, height: 900 });

  // WebP VP8X: signature, dimensions, and EXIF/XMP chunk stripping + flag clearing
  const webpOk = makeSyntheticWebpVp8x(1400, 700, true);
  assert.equal(detectImageSignature(webpOk), "webp");
  assert.deepEqual(readImageDimensions(webpOk, "webp"), { width: 1400, height: 700 });
  const strippedWebp = stripImageMetadata(webpOk, "webp");
  const strippedWebpStr = new TextDecoder().decode(strippedWebp);
  assert.equal(strippedWebpStr.includes("SECRET_EXIF"), false);
  assert.equal(strippedWebpStr.includes("SECRET_XMP"), false);
  assert.deepEqual(readImageDimensions(strippedWebp, "webp"), { width: 1400, height: 700 });
});
