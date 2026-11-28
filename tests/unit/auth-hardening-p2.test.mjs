import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import {
  maybeCleanupExpiredOtps,
  processPasswordResetService,
  processPinResetService,
  registerUserAccountService,
  resendOtpService,
  verifyOtpService,
  verifyPinService,
} from "../../src/services/auth.service.ts";
import { generateQrDataUrl } from "../../src/lib/auth/qr-image.ts";
import { consumeConfirmedQrToken } from "../../src/lib/auth/qr.ts";
import { clearRateLimitMemory } from "../../src/lib/auth/rate-limit.ts";
import { signupSchema } from "../../src/validators/auth.ts";

const TEST_SECRET = "auth-hardening-p2-unit-test-secret-0123456789abcdef";
const TEST_PASSWORD = "StrongPassword@123";
const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);
const TEST_PIN = "654321";
const TEST_PIN_HASH = bcrypt.hashSync(TEST_PIN, 4);

function sha256Hex(raw) {
  return crypto.createHash("sha256").update(raw, "utf-8").digest("hex");
}

function withTestEnv(fn) {
  return async () => {
    const prevSecret = process.env.SECRET_KEY;
    const prevResend = process.env.RESEND_API_KEY;
    process.env.SECRET_KEY = TEST_SECRET;
    delete process.env.RESEND_API_KEY;
    clearRateLimitMemory();
    try {
      await fn();
    } finally {
      clearRateLimitMemory();
      if (prevSecret === undefined) delete process.env.SECRET_KEY;
      else process.env.SECRET_KEY = prevSecret;
      if (prevResend === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = prevResend;
    }
  };
}

function createAuthP2MockDb(overrides = {}) {
  const db = {
    users: structuredClone(overrides.users ?? []),
    account_requests: structuredClone(overrides.account_requests ?? []),
    login_sessions: structuredClone(overrides.login_sessions ?? []),
    qr_login_tokens: structuredClone(overrides.qr_login_tokens ?? []),
    system_settings: structuredClone(
      overrides.system_settings ?? [
        {
          id: 1,
          maintenance_enabled: false,
          maintenance_message: "",
          bypass_role: "admin",
          lockdown_enabled: false,
        },
      ]
    ),
    audit_logs: [],
    error_logs: [],
    auth_rate_limits: [],
  };

  let otpCleanupUpdateCalls = 0;

  function makeQuery(tableName) {
    const state = {
      table: tableName,
      op: "select",
      filters: [],
      payload: null,
      limitCount: null,
      singleMode: null,
    };

    function matchesFilters(row) {
      return state.filters.every((f) => {
        const val = row[f.col];
        if (f.type === "eq") return val === f.val;
        if (f.type === "in") return Array.isArray(f.val) && f.val.includes(val);
        if (f.type === "is") return f.val === null ? val === null || val === undefined : val === f.val;
        if (f.type === "not_is_null") return val !== null && val !== undefined;
        if (f.type === "lt") {
          if (val === null || val === undefined) return false;
          return String(val) < String(f.val);
        }
        return true;
      });
    }

    function execute() {
      const table = db[state.table] ?? (db[state.table] = []);

      if (state.op === "insert") {
        const rows = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = rows.map((r) => {
          const nextId =
            r.id ?? (table.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1);
          const copy = { id: nextId, logout_at: null, ...structuredClone(r) };
          table.push(copy);
          return copy;
        });
        const data = state.singleMode ? inserted[0] ?? null : inserted;
        return { data, error: null };
      }

      if (state.op === "update") {
        if (
          state.table === "users" &&
          state.payload &&
          "otp_code" in state.payload &&
          state.payload.otp_code === null &&
          state.filters.some((f) => f.type === "lt" && f.col === "otp_expiry")
        ) {
          otpCleanupUpdateCalls++;
        }
        const updated = [];
        for (const row of table) {
          if (matchesFilters(row)) {
            Object.assign(row, structuredClone(state.payload));
            updated.push(row);
          }
        }
        return { data: updated, error: null };
      }

      if (state.op === "delete") {
        const kept = [];
        const removed = [];
        for (const row of table) {
          if (matchesFilters(row)) removed.push(row);
          else kept.push(row);
        }
        db[state.table] = kept;
        return { data: removed, error: null };
      }

      let rows = table.filter(matchesFilters);
      if (state.limitCount !== null) rows = rows.slice(0, state.limitCount);
      if (state.singleMode === "maybeSingle") {
        return { data: rows[0] ? structuredClone(rows[0]) : null, error: null };
      }
      if (state.singleMode === "single") {
        if (!rows[0]) return { data: null, error: { code: "PGRST116", message: "Not found" } };
        return { data: structuredClone(rows[0]), error: null };
      }
      return { data: structuredClone(rows), error: null };
    }

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
      delete() {
        state.op = "delete";
        return builder;
      },
      eq(col, val) {
        state.filters.push({ type: "eq", col, val });
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
      not(col, op, val) {
        if (op === "is" && val === null) {
          state.filters.push({ type: "not_is_null", col });
        }
        return builder;
      },
      lt(col, val) {
        state.filters.push({ type: "lt", col, val });
        return builder;
      },
      order() {
        return builder;
      },
      limit(n) {
        state.limitCount = n;
        return builder;
      },
      maybeSingle() {
        state.singleMode = "maybeSingle";
        return Promise.resolve(execute());
      },
      single() {
        state.singleMode = "single";
        return Promise.resolve(execute());
      },
      then(resolve, reject) {
        return Promise.resolve(execute()).then(resolve, reject);
      },
    };
    return builder;
  }

  return {
    db,
    getOtpCleanupUpdateCalls: () => otpCleanupUpdateCalls,
    supabase: {
      from: (table) => makeQuery(table),
    },
  };
}

function makeBaseUser(overrides = {}) {
  return {
    id: 100,
    username: "patron.p2@example.com",
    email_display: "patron.p2@example.com",
    firstname: "Juan",
    lastname: "Dela Cruz",
    password: TEST_PASSWORD_HASH,
    role: "user",
    is_approved: true,
    is_active: true,
    is_locked: false,
    failed_attempts: 0,
    lock_until: null,
    otp_enabled: false,
    otp_code: null,
    otp_expiry: null,
    pin_enabled: false,
    pin_code: null,
    pin_set_at: null,
    reset_token: null,
    reset_token_expiry: null,
    pin_reset_token: null,
    pin_reset_token_expiry: null,
    ...overrides,
  };
}

function makeValidPatronInput(overrides = {}) {
  return {
    firstname: "Maria",
    lastname: "Clara",
    age: 24,
    gender: "Female",
    phone: "09171234567",
    school: "WVSU",
    city: "Iloilo City",
    province: "Iloilo",
    education_level: "College",
    occupation: "Student",
    is_government: false,
    office_phone: "",
    valid_id_name: "",
    email: "maria.clara@example.com",
    password: TEST_PASSWORD,
    confirm_password: TEST_PASSWORD,
    role: "user",
    ...overrides,
  };
}

// Valid minimal magic-byte payloads (>= 12 bytes for detectImageSignature)
const VALID_JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);
const VALID_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);
const VALID_WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x14, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
const VALID_PDF_BYTES = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");

test("1. QR local generation returns data:image/svg+xml;base64 with valid <svg, zero external URLs, and no api.qrserver.com in route", () => {
  const scanUrl = "https://library.example.gov.ph/scan-qr?token=0123456789abcdef0123456789abcdef";
  const dataUrl = generateQrDataUrl(scanUrl);

  assert.ok(
    dataUrl.startsWith("data:image/svg+xml;base64,"),
    "generateQrDataUrl must return a data:image/svg+xml;base64 URI"
  );
  assert.equal(dataUrl.includes("api.qrserver.com"), false);

  const b64 = dataUrl.slice("data:image/svg+xml;base64,".length);
  const svg = Buffer.from(b64, "base64").toString("utf8");
  assert.ok(svg.startsWith("<svg "), "Decoded payload must start with <svg");
  assert.ok(svg.endsWith("</svg>"), "Decoded payload must end with </svg>");
  assert.ok(svg.includes("<path "), "Decoded SVG must contain QR module path data");

  // Strip the standard SVG XML namespace and verify zero external URLs remain
  const svgWithoutXmlns = svg.replace('xmlns="http://www.w3.org/2000/svg"', "");
  assert.equal(
    /https?:\/\//i.test(svgWithoutXmlns),
    false,
    "Generated QR SVG must contain zero external URLs"
  );

  // Confirm api.qrserver.com is completely absent from src/app/api/auth/qr/route.ts
  const qrRoutePath = path.resolve(process.cwd(), "src/app/api/auth/qr/route.ts");
  const qrRouteSrc = fs.readFileSync(qrRoutePath, "utf8");
  assert.equal(
    qrRouteSrc.includes("api.qrserver.com"),
    false,
    "src/app/api/auth/qr/route.ts must not reference api.qrserver.com"
  );
});

test(
  "1b. consumeConfirmedQrToken resets failed_attempts, is_locked, and lock_until on successful QR login",
  withTestEnv(async () => {
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const { supabase, db } = createAuthP2MockDb({
      users: [
        makeBaseUser({
          id: 77,
          failed_attempts: 4,
          is_locked: true,
          lock_until: pastIso, // expired lock
        }),
      ],
      qr_login_tokens: [
        {
          id: 1,
          token: "qr-token-1234567890abcdef",
          user_id: 77,
          status: "confirmed",
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    });

    const result = await consumeConfirmedQrToken(supabase, db.qr_login_tokens[0]);
    assert.equal(result.ok, true);
    const updatedUser = db.users.find((u) => u.id === 77);
    assert.equal(updatedUser.failed_attempts, 0);
    assert.equal(updatedUser.is_locked, false);
    assert.equal(updatedUser.lock_until, null);
    assert.equal(updatedUser.status, "active");
    assert.ok(updatedUser.last_seen);
  })
);

test(
  "2. Signup valid ID validation rejects >2MB, rejects spoofed/unsupported MIME, accepts JPEG/PNG/WebP/PDF, and uses safe server filename",
  withTestEnv(async () => {
    const prevAppKey = process.env.DROPBOX_APP_KEY;
    const prevAppSecret = process.env.DROPBOX_APP_SECRET;
    const prevRefresh = process.env.DROPBOX_REFRESH_TOKEN;
    const prevEncKey = process.env.DATA_ENCRYPTION_KEY;
    const prevFetch = globalThis.fetch;

    const uploadedPaths = [];
    process.env.DROPBOX_APP_KEY = "test-app-key";
    process.env.DROPBOX_APP_SECRET = "test-app-secret";
    process.env.DROPBOX_REFRESH_TOKEN = "test-refresh-token";
    delete process.env.DATA_ENCRYPTION_KEY;

    globalThis.fetch = async (url, init) => {
      const target = String(url);
      if (target.includes("oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock-dropbox-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (target.includes("/2/files/upload")) {
        const argHeader = init?.headers?.["Dropbox-API-Arg"] || "";
        const parsedArg = JSON.parse(argHeader);
        uploadedPaths.push(parsedArg.path);
        return new Response(JSON.stringify({ path_display: parsedArg.path }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch URL in unit test: ${target}`);
    };

    try {
      const { supabase, db } = createAuthP2MockDb();

      // Reject >2MB file
      const oversizedBytes = new Uint8Array(2 * 1024 * 1024 + 1);
      oversizedBytes.set(VALID_JPEG_BYTES, 0);
      const oversizedFile = new File([oversizedBytes], "too-large.jpg", { type: "image/jpeg" });
      await assert.rejects(
        () =>
          registerUserAccountService(
            supabase,
            makeValidPatronInput({ email: "oversize@example.com" }),
            null,
            "127.0.0.1",
            oversizedFile
          ),
        (err) => err.status === 400 && /2 MB/i.test(err.message)
      );

      // Reject spoofed magic bytes (plain text claiming image/jpeg)
      const spoofedText = new File(
        [new TextEncoder().encode("<html>not really a jpeg file</html>")],
        "spoof.jpg",
        { type: "image/jpeg" }
      );
      await assert.rejects(
        () =>
          registerUserAccountService(
            supabase,
            makeValidPatronInput({ email: "spoof1@example.com" }),
            null,
            "127.0.0.2",
            spoofedText
          ),
        (err) => err.status === 400 && /unsupported valid id/i.test(err.message)
      );

      // Reject MIME mismatch (PNG magic bytes declared as image/jpeg)
      const mismatchedMime = new File([VALID_PNG_BYTES], "fake.jpg", { type: "image/jpeg" });
      await assert.rejects(
        () =>
          registerUserAccountService(
            supabase,
            makeValidPatronInput({ email: "spoof2@example.com" }),
            null,
            "127.0.0.3",
            mismatchedMime
          ),
        (err) => err.status === 400 && /does not match/i.test(err.message)
      );

      // Reject unsupported GIF magic bytes
      const gifBytes = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00,
      ]);
      const gifFile = new File([gifBytes], "anim.gif", { type: "image/gif" });
      await assert.rejects(
        () =>
          registerUserAccountService(
            supabase,
            makeValidPatronInput({ email: "spoof3@example.com" }),
            null,
            "127.0.0.4",
            gifFile
          ),
        (err) => err.status === 400 && /unsupported valid id/i.test(err.message)
      );

      // Accept genuine JPEG, PNG, WebP, and PDF with untrusted client filenames
      const validCases = [
        { bytes: VALID_JPEG_BYTES, name: "../../evil.exe", mime: "image/jpeg", ext: ".jpg", email: "ok.jpg@example.com", ip: "127.0.0.10" },
        { bytes: VALID_PNG_BYTES, name: "my id (1).png", mime: "image/png", ext: ".png", email: "ok.png@example.com", ip: "127.0.0.11" },
        { bytes: VALID_WEBP_BYTES, name: "scan.webp", mime: "image/webp", ext: ".webp", email: "ok.webp@example.com", ip: "127.0.0.12" },
        { bytes: VALID_PDF_BYTES, name: "passport.pdf", mime: "application/pdf", ext: ".pdf", email: "ok.pdf@example.com", ip: "127.0.0.13" },
      ];

      for (const c of validCases) {
        const beforeCount = uploadedPaths.length;
        const file = new File([c.bytes], c.name, { type: c.mime });
        const res = await registerUserAccountService(
          supabase,
          makeValidPatronInput({ email: c.email }),
          null,
          c.ip,
          file
        );
        assert.equal(res.ok, true);
        assert.equal(uploadedPaths.length, beforeCount + 1);

        const dropboxPath = uploadedPaths[uploadedPaths.length - 1];
        const expectedPattern = new RegExp(`^/.+/[a-f0-9]{32}\\${c.ext}$`);
        assert.match(
          dropboxPath,
          expectedPattern,
          `Dropbox path "${dropboxPath}" must use a 32-hex server-generated filename with ${c.ext}`
        );
        assert.equal(dropboxPath.includes("evil"), false);
        assert.equal(dropboxPath.includes(".."), false);

        const createdUser = db.users.find((u) => u.id === res.id);
        assert.equal(createdUser.valid_id_path, dropboxPath);
      }
    } finally {
      globalThis.fetch = prevFetch;
      if (prevAppKey === undefined) delete process.env.DROPBOX_APP_KEY;
      else process.env.DROPBOX_APP_KEY = prevAppKey;
      if (prevAppSecret === undefined) delete process.env.DROPBOX_APP_SECRET;
      else process.env.DROPBOX_APP_SECRET = prevAppSecret;
      if (prevRefresh === undefined) delete process.env.DROPBOX_REFRESH_TOKEN;
      else process.env.DROPBOX_REFRESH_TOKEN = prevRefresh;
      if (prevEncKey === undefined) delete process.env.DATA_ENCRYPTION_KEY;
      else process.env.DATA_ENCRYPTION_KEY = prevEncKey;
    }
  })
);

test(
  "3. Signup patron defaults: rejects decimal age, accepts integer age, sets is_active=false & is_approved=false for patrons (staff stays true, true)",
  withTestEnv(async () => {
    // Decimal age rejected (both numeric and string forms)
    assert.equal(signupSchema.safeParse(makeValidPatronInput({ age: 18.5 })).success, false);
    assert.equal(signupSchema.safeParse(makeValidPatronInput({ age: "18.5" })).success, false);

    // Integer age accepted (both numeric and string forms)
    assert.equal(signupSchema.safeParse(makeValidPatronInput({ age: 18 })).success, true);
    assert.equal(signupSchema.safeParse(makeValidPatronInput({ age: "21" })).success, true);

    const adminSessionToken = "admin-session-token-0123456789abcdef";
    const { supabase, db } = createAuthP2MockDb({
      users: [
        makeBaseUser({
          id: 1,
          username: "admin@iloilolibrary.gov.ph",
          email_display: "admin@iloilolibrary.gov.ph",
          role: "admin",
          is_active: true,
          is_approved: true,
        }),
      ],
      login_sessions: [
        { id: 1, user_id: 1, session_token: adminSessionToken, logout_at: null },
      ],
    });

    // Patron registration -> is_active: false, is_approved: false + pending account_request
    const patronRes = await registerUserAccountService(
      supabase,
      signupSchema.parse(makeValidPatronInput({ email: "new.patron@example.com", age: "25" })),
      null,
      "127.0.0.20",
      null
    );
    assert.equal(patronRes.ok, true);
    assert.equal(patronRes.isStaffCreation, false);
    const patronRow = db.users.find((u) => u.id === patronRes.id);
    assert.equal(patronRow.is_active, false);
    assert.equal(patronRow.is_approved, false);
    assert.equal(
      db.account_requests.some((r) => r.user_id === patronRes.id && r.request_type === "register"),
      true
    );

    // Staff creation by admin -> is_active: true, is_approved: true
    const staffInput = signupSchema.parse({
      firstname: "Elena",
      lastname: "Reyes",
      email: "elena.reyes@iloilolibrary.gov.ph",
      password: TEST_PASSWORD,
      role: "librarian",
    });
    const staffRes = await registerUserAccountService(
      supabase,
      staffInput,
      {
        userId: 1,
        role: "admin",
        email: "admin@iloilolibrary.gov.ph",
        sessionToken: adminSessionToken,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      "127.0.0.20",
      null
    );
    assert.equal(staffRes.ok, true);
    assert.equal(staffRes.isStaffCreation, true);
    const staffRow = db.users.find((u) => u.id === staffRes.id);
    assert.equal(staffRow.is_active, true);
    assert.equal(staffRow.is_approved, true);
  })
);

test(
  "4. OTP and password/PIN reset flows reject !is_active || !is_approved users",
  withTestEnv(async () => {
    const futureIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const unapprovedPwTok = crypto.randomBytes(32).toString("hex");
    const unapprovedPinTok = crypto.randomBytes(32).toString("hex");
    const inactivePwTok = crypto.randomBytes(32).toString("hex");
    const inactivePinTok = crypto.randomBytes(32).toString("hex");

    const { supabase, db } = createAuthP2MockDb({
      users: [
        makeBaseUser({
          id: 201,
          username: "pending.user@example.com",
          email_display: "pending.user@example.com",
          is_active: true,
          is_approved: false,
          otp_enabled: true,
          otp_code: await bcrypt.hash("123456", 4),
          otp_expiry: futureIso,
          pin_enabled: true,
          pin_code: TEST_PIN_HASH,
          pin_set_at: new Date().toISOString(),
          reset_token: sha256Hex(unapprovedPwTok),
          reset_token_expiry: futureIso,
          pin_reset_token: sha256Hex(unapprovedPinTok),
          pin_reset_token_expiry: futureIso,
        }),
        makeBaseUser({
          id: 202,
          username: "disabled.user@example.com",
          email_display: "disabled.user@example.com",
          is_active: false,
          is_approved: true,
          otp_enabled: true,
          otp_code: await bcrypt.hash("123456", 4),
          otp_expiry: futureIso,
          pin_enabled: true,
          pin_code: TEST_PIN_HASH,
          pin_set_at: new Date().toISOString(),
          reset_token: sha256Hex(inactivePwTok),
          reset_token_expiry: futureIso,
          pin_reset_token: sha256Hex(inactivePinTok),
          pin_reset_token_expiry: futureIso,
        }),
      ],
    });

    // OTP & PIN MFA flows reject both !is_approved (201) and !is_active (202) with 401
    for (const uid of [201, 202]) {
      const pendingOtp = {
        uid,
        step: "otp",
        methods: ["otp"],
        exp: Math.floor(Date.now() / 1000) + 600,
      };
      const pendingPin = {
        uid,
        step: "pin",
        methods: ["pin"],
        exp: Math.floor(Date.now() / 1000) + 600,
      };

      await assert.rejects(
        () => verifyOtpService(supabase, pendingOtp, { otp: "123456" }, "http://localhost:3000", "127.0.0.1"),
        (err) => err.status === 401
      );
      await assert.rejects(
        () => verifyPinService(supabase, pendingPin, { pin: TEST_PIN }, "http://localhost:3000", "127.0.0.1"),
        (err) => err.status === 401
      );
      await assert.rejects(
        () => resendOtpService(supabase, pendingOtp, "127.0.0.1"),
        (err) => err.status === 401
      );
    }

    // Password & PIN reset "request" must NOT overwrite/issue tokens for !is_approved or !is_active
    const before201Pw = db.users.find((u) => u.id === 201).reset_token;
    const before201Pin = db.users.find((u) => u.id === 201).pin_reset_token;
    const before202Pw = db.users.find((u) => u.id === 202).reset_token;
    const before202Pin = db.users.find((u) => u.id === 202).pin_reset_token;

    await processPasswordResetService(
      supabase,
      { action: "request", email: "pending.user@example.com" },
      "http://localhost:3000",
      "127.0.0.1"
    );
    await processPinResetService(
      supabase,
      { action: "request", email: "pending.user@example.com" },
      "http://localhost:3000",
      "127.0.0.1"
    );
    await processPasswordResetService(
      supabase,
      { action: "request", email: "disabled.user@example.com" },
      "http://localhost:3000",
      "127.0.0.1"
    );
    await processPinResetService(
      supabase,
      { action: "request", email: "disabled.user@example.com" },
      "http://localhost:3000",
      "127.0.0.1"
    );

    assert.equal(db.users.find((u) => u.id === 201).reset_token, before201Pw);
    assert.equal(db.users.find((u) => u.id === 201).pin_reset_token, before201Pin);
    assert.equal(db.users.find((u) => u.id === 202).reset_token, before202Pw);
    assert.equal(db.users.find((u) => u.id === 202).pin_reset_token, before202Pin);

    // Password & PIN reset "confirm" reject both !is_approved and !is_active with 403
    for (const pwTok of [unapprovedPwTok, inactivePwTok]) {
      await assert.rejects(
        () =>
          processPasswordResetService(
            supabase,
            {
              action: "confirm",
              token: pwTok,
              new_password: "NewStrongPassword@999",
              confirm_password: "NewStrongPassword@999",
            },
            "http://localhost:3000",
            "127.0.0.1"
          ),
        (err) => err.status === 403
      );
    }

    for (const pinTok of [unapprovedPinTok, inactivePinTok]) {
      await assert.rejects(
        () =>
          processPinResetService(
            supabase,
            {
              action: "confirm",
              token: pinTok,
              pin: "135790",
              confirm_pin: "135790",
            },
            "http://localhost:3000",
            "127.0.0.1"
          ),
        (err) => err.status === 403
      );
    }
  })
);

test(
  "5. Lazy expired-OTP cleanup clears expired OTPs and respects 60s throttle cooldown",
  withTestEnv(async () => {
    const origDateNow = Date.now;
    let fakeNow = origDateNow() + 120_000; // ensure fresh window independent of earlier tests
    Date.now = () => fakeNow;

    try {
      const expiredIso = new Date(fakeNow - 60_000).toISOString();
      const activeIso = new Date(fakeNow + 300_000).toISOString();

      const { supabase, db, getOtpCleanupUpdateCalls } = createAuthP2MockDb({
        users: [
          makeBaseUser({ id: 301, otp_code: "hash-expired", otp_expiry: expiredIso }),
          makeBaseUser({ id: 302, otp_code: "hash-active", otp_expiry: activeIso }),
        ],
      });

      // First call executes cleanup
      maybeCleanupExpiredOtps(supabase);
      await new Promise((r) => setImmediate(r));

      assert.equal(getOtpCleanupUpdateCalls(), 1);
      assert.equal(db.users.find((u) => u.id === 301).otp_code, null);
      assert.equal(db.users.find((u) => u.id === 301).otp_expiry, null);
      assert.equal(db.users.find((u) => u.id === 302).otp_code, "hash-active");
      assert.equal(db.users.find((u) => u.id === 302).otp_expiry, activeIso);

      // Second call within 60s cooldown must be throttled (no DB update)
      fakeNow += 30_000;
      maybeCleanupExpiredOtps(supabase);
      await new Promise((r) => setImmediate(r));
      assert.equal(getOtpCleanupUpdateCalls(), 1, "Cleanup must be throttled within 60s cooldown");

      // After 60s cooldown passes, cleanup executes again
      fakeNow += 31_000;
      db.users.find((u) => u.id === 302).otp_expiry = new Date(fakeNow - 1_000).toISOString();
      maybeCleanupExpiredOtps(supabase);
      await new Promise((r) => setImmediate(r));

      assert.equal(getOtpCleanupUpdateCalls(), 2, "Cleanup must run again after 60s cooldown");
      assert.equal(db.users.find((u) => u.id === 302).otp_code, null);
      assert.equal(db.users.find((u) => u.id === 302).otp_expiry, null);
    } finally {
      Date.now = origDateNow;
    }
  })
);
