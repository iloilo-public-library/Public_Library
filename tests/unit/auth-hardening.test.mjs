import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import {
  authenticateUserLogin,
  processPasswordResetService,
  processPinResetService,
  resendOtpService,
  verifyOtpService,
  verifyPinService,
} from "../../src/services/auth.service.ts";
import {
  getSigningSecret,
  signPendingMfaToken,
  signSession,
  verifyPendingMfaToken,
  verifySession,
} from "../../src/lib/auth/session.ts";
import {
  consumeVerifiedCaptchaToken,
  signCaptchaChallenge,
  signVerifiedCaptchaToken,
} from "../../src/lib/auth/captcha.ts";
import { clearRateLimitMemory } from "../../src/lib/auth/rate-limit.ts";
import {
  loginSchema,
  resendOtpSchema,
  verifyOtpSchema,
  verifyPinSchema,
} from "../../src/validators/auth.ts";

const TEST_SECRET = "auth-hardening-unit-test-secret-0123456789abcdef";
const TEST_PASSWORD = "StrongPassword@123";
const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);
const TEST_PIN = "654321";
const TEST_PIN_HASH = bcrypt.hashSync(TEST_PIN, 4);

function sha256Hex(raw) {
  return crypto.createHash("sha256").update(raw, "utf-8").digest("hex");
}

function withTestSecret(fn) {
  return async () => {
    const prevSecret = process.env.SECRET_KEY;
    process.env.SECRET_KEY = TEST_SECRET;
    clearRateLimitMemory();
    try {
      await fn();
    } finally {
      clearRateLimitMemory();
      if (prevSecret === undefined) {
        delete process.env.SECRET_KEY;
      } else {
        process.env.SECRET_KEY = prevSecret;
      }
    }
  };
}

function createAuthMockDb(overrides = {}) {
  const nowIso = new Date().toISOString();
  const db = {
    users: structuredClone(overrides.users ?? []),
    login_sessions: structuredClone(overrides.login_sessions ?? []),
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
          if (matchesFilters(row)) {
            removed.push(row);
          } else {
            kept.push(row);
          }
        }
        db[state.table] = kept;
        return { data: removed, error: null };
      }

      let rows = table.filter(matchesFilters);
      if (state.limitCount !== null) {
        rows = rows.slice(0, state.limitCount);
      }
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
    nowIso,
    supabase: {
      from: (table) => makeQuery(table),
    },
  };
}

function makeBaseUser(overrides = {}) {
  return {
    id: 501,
    username: "member.mfa@example.com",
    email_display: "member.mfa@example.com",
    firstname: "Maria",
    lastname: "Santos",
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

test(
  "1. MFA required blocks full session cookie & returns { ok: true, mfa_required: true, methods } + pending-MFA cookie",
  withTestSecret(async () => {
    const { supabase, db } = createAuthMockDb({
      users: [
        makeBaseUser({
          id: 10,
          otp_enabled: true,
          pin_enabled: true,
          pin_code: TEST_PIN_HASH,
          pin_set_at: new Date().toISOString(),
        }),
      ],
    });

    const { captcha_token } = signVerifiedCaptchaToken();
    const res = await authenticateUserLogin(
      supabase,
      {
        email: "member.mfa@example.com",
        password: TEST_PASSWORD,
        captcha_token,
      },
      "127.0.0.1"
    );

    assert.equal(res.ok, true);
    assert.equal(res.mfa_required, true);
    assert.deepEqual(res.methods, ["otp", "pin"]);
    assert.equal("signedCookie" in res, false, "Full session cookie must NOT be issued before MFA");
    assert.equal(db.login_sessions.length, 0, "No login_sessions row may be created before MFA passes");

    // Pending-MFA cookie is valid for MFA, and strictly isolated from full session verification
    const pending = verifyPendingMfaToken(res.pendingMfaCookie);
    assert.ok(pending);
    assert.equal(pending.uid, 10);
    assert.equal(pending.step, "otp");
    assert.deepEqual(pending.methods, ["otp", "pin"]);
    assert.equal(
      verifySession(res.pendingMfaCookie),
      null,
      "Pending-MFA token must NOT verify as a full session token"
    );

    // OTP was generated & stored hashed
    const userRow = db.users.find((u) => u.id === 10);
    assert.ok(userRow.otp_code && userRow.otp_code.startsWith("$2"), "OTP must be bcrypt-hashed");
    assert.ok(userRow.otp_expiry, "OTP expiry must be set");
  })
);

test(
  "2. OTP then PIN issues full session cookie only after PIN passes (and enforces token isolation)",
  withTestSecret(async () => {
    const otpPlain = "482913";
    const otpHash = await bcrypt.hash(otpPlain, 4);
    const { supabase, db } = createAuthMockDb({
      users: [
        makeBaseUser({
          id: 11,
          role: "librarian",
          username: "lib.mfa@iloilolibrary.gov.ph",
          email_display: "lib.mfa@iloilolibrary.gov.ph",
          otp_enabled: true,
          otp_code: otpHash,
          otp_expiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          pin_enabled: true,
          pin_code: TEST_PIN_HASH,
          pin_set_at: new Date().toISOString(),
        }),
      ],
    });

    const step1Pending = verifyPendingMfaToken(
      signPendingMfaToken({ uid: 11, step: "otp", methods: ["otp", "pin"] })
    );
    assert.ok(step1Pending);

    // Wrong step: trying PIN while still on OTP step fails with 400
    await assert.rejects(
      () =>
        verifyPinService(
          supabase,
          step1Pending,
          { pin: TEST_PIN },
          "http://localhost:3000",
          "127.0.0.1"
        ),
      (err) => err.status === 400
    );

    // Step 1: verify OTP -> advances to PIN step, still no full session cookie
    const otpRes = await verifyOtpService(
      supabase,
      step1Pending,
      { otp: otpPlain },
      "http://localhost:3000",
      "127.0.0.1"
    );

    assert.equal(otpRes.ok, true);
    assert.equal(otpRes.verified, true);
    assert.equal(otpRes.mfa_required, true);
    assert.deepEqual(otpRes.methods, ["pin"]);
    assert.equal("signedCookie" in otpRes, false, "Full session cookie must NOT be issued before PIN");
    assert.equal(db.login_sessions.length, 0, "No login_sessions row before PIN passes");

    const step2Pending = verifyPendingMfaToken(otpRes.pendingMfaCookie);
    assert.ok(step2Pending);
    assert.equal(step2Pending.uid, 11);
    assert.equal(step2Pending.step, "pin");
    assert.deepEqual(step2Pending.methods, ["pin"]);

    // Wrong PIN -> rejected with 400, still no session
    await assert.rejects(
      () =>
        verifyPinService(
          supabase,
          step2Pending,
          { pin: "000000" },
          "http://localhost:3000",
          "127.0.0.1"
        ),
      (err) => err.status === 400
    );
    assert.equal(db.login_sessions.length, 0);

    // Step 2: verify PIN -> issues full session cookie + login_sessions row
    const pinRes = await verifyPinService(
      supabase,
      step2Pending,
      { pin: TEST_PIN },
      "http://localhost:3000",
      "127.0.0.1"
    );

    assert.equal(pinRes.ok, true);
    assert.equal(pinRes.verified, true);
    assert.equal(pinRes.role, "librarian");
    assert.equal(pinRes.redirectUrl, "/librarian/dashboard");
    assert.ok(pinRes.signedCookie);
    assert.equal(db.login_sessions.length, 1);
    assert.equal(db.login_sessions[0].user_id, 11);

    const verifiedSession = verifySession(pinRes.signedCookie);
    assert.ok(verifiedSession);
    assert.equal(verifiedSession.userId, 11);
    assert.equal(verifiedSession.role, "librarian");
    assert.equal(
      verifyPendingMfaToken(pinRes.signedCookie),
      null,
      "Full session cookie must NOT verify as a pending-MFA token"
    );
  })
);

test(
  "3. Replayed captcha token is rejected (and challenge token cannot be used as verified token)",
  withTestSecret(async () => {
    const { supabase } = createAuthMockDb({
      users: [makeBaseUser({ id: 20 })],
    });

    const { captcha_token } = signVerifiedCaptchaToken();

    // First login consumes the captcha token and succeeds
    const first = await authenticateUserLogin(
      supabase,
      {
        email: "member.mfa@example.com",
        password: TEST_PASSWORD,
        captcha_token,
      },
      "127.0.0.1"
    );
    assert.equal(first.ok, true);
    assert.equal(first.mfa_required, false);

    // Second login replaying the exact same captcha_token must be rejected with 400
    await assert.rejects(
      () =>
        authenticateUserLogin(
          supabase,
          {
            email: "member.mfa@example.com",
            password: TEST_PASSWORD,
            captcha_token,
          },
          "127.0.0.1"
        ),
      (err) => err.status === 400 && /already been used/i.test(err.message)
    );

    // Challenge token must NOT be accepted as a verified captcha_token
    const challenge = signCaptchaChallenge("12");
    const check = consumeVerifiedCaptchaToken(challenge.token);
    assert.equal(check.valid, false);
  })
);

test(
  "4. Permanent lock (is_locked=true, lock_until=null) and active timed lock are rejected with 423",
  withTestSecret(async () => {
    const { supabase } = createAuthMockDb({
      users: [
        makeBaseUser({
          id: 30,
          username: "perm.locked@example.com",
          email_display: "perm.locked@example.com",
          is_locked: true,
          lock_until: null,
        }),
        makeBaseUser({
          id: 31,
          username: "timed.locked@example.com",
          email_display: "timed.locked@example.com",
          is_locked: true,
          lock_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }),
      ],
    });

    const tok1 = signVerifiedCaptchaToken().captcha_token;
    await assert.rejects(
      () =>
        authenticateUserLogin(
          supabase,
          {
            email: "perm.locked@example.com",
            password: TEST_PASSWORD,
            captcha_token: tok1,
          },
          "127.0.0.1"
        ),
      (err) => err.status === 423 && err.code === "ACCOUNT_LOCKED"
    );

    const tok2 = signVerifiedCaptchaToken().captcha_token;
    await assert.rejects(
      () =>
        authenticateUserLogin(
          supabase,
          {
            email: "timed.locked@example.com",
            password: TEST_PASSWORD,
            captcha_token: tok2,
          },
          "127.0.0.1"
        ),
      (err) => err.status === 423 && err.code === "ACCOUNT_LOCKED"
    );
  })
);

test(
  "5. Password & PIN reset confirm reject !is_active, hash tokens with SHA-256, and close all open login_sessions",
  withTestSecret(async () => {
    const rawPwToken = crypto.randomBytes(32).toString("hex");
    const rawPinToken = crypto.randomBytes(32).toString("hex");
    const inactivePwToken = crypto.randomBytes(32).toString("hex");
    const inactivePinToken = crypto.randomBytes(32).toString("hex");
    const futureIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { supabase, db } = createAuthMockDb({
      users: [
        makeBaseUser({
          id: 40,
          username: "active.reset@example.com",
          email_display: "active.reset@example.com",
          reset_token: sha256Hex(rawPwToken),
          reset_token_expiry: futureIso,
          pin_reset_token: sha256Hex(rawPinToken),
          pin_reset_token_expiry: futureIso,
        }),
        makeBaseUser({
          id: 41,
          username: "inactive.reset@example.com",
          email_display: "inactive.reset@example.com",
          is_active: false,
          reset_token: sha256Hex(inactivePwToken),
          reset_token_expiry: futureIso,
          pin_reset_token: sha256Hex(inactivePinToken),
          pin_reset_token_expiry: futureIso,
        }),
      ],
      login_sessions: [
        { id: 1, user_id: 40, session_token: "sess-40-a", logout_at: null },
        { id: 2, user_id: 40, session_token: "sess-40-b", logout_at: null },
        { id: 3, user_id: 99, session_token: "sess-99-other", logout_at: null },
      ],
    });

    // Request step stores SHA-256 hash (64 hex chars), never plaintext
    await processPasswordResetService(
      supabase,
      { action: "request", email: "active.reset@example.com" },
      "http://localhost:3000",
      "127.0.0.1"
    );
    const afterReq = db.users.find((u) => u.id === 40);
    assert.match(afterReq.reset_token, /^[a-f0-9]{64}$/);
    // Restore our known test hash so we can confirm with rawPwToken
    afterReq.reset_token = sha256Hex(rawPwToken);
    afterReq.reset_token_expiry = futureIso;

    // Inactive account rejected on password reset confirm (403)
    await assert.rejects(
      () =>
        processPasswordResetService(
          supabase,
          {
            action: "confirm",
            token: inactivePwToken,
            new_password: "NewStrongPassword@999",
            confirm_password: "NewStrongPassword@999",
          },
          "http://localhost:3000",
          "127.0.0.1"
        ),
      (err) => err.status === 403
    );

    // Inactive account rejected on PIN reset confirm (403)
    await assert.rejects(
      () =>
        processPinResetService(
          supabase,
          {
            action: "confirm",
            token: inactivePinToken,
            pin: "135790",
            confirm_pin: "135790",
          },
          "http://localhost:3000",
          "127.0.0.1"
        ),
      (err) => err.status === 403
    );

    // Passing the SHA-256 hash directly instead of raw token must fail (proves server hashes input)
    await assert.rejects(
      () =>
        processPasswordResetService(
          supabase,
          {
            action: "confirm",
            token: sha256Hex(rawPwToken),
            new_password: "NewStrongPassword@999",
            confirm_password: "NewStrongPassword@999",
          },
          "http://localhost:3000",
          "127.0.0.1"
        ),
      (err) => err.status === 400
    );

    // Active account password reset confirm succeeds & closes all open login_sessions for user 40
    const pwRes = await processPasswordResetService(
      supabase,
      {
        action: "confirm",
        token: rawPwToken,
        new_password: "NewStrongPassword@999",
        confirm_password: "NewStrongPassword@999",
      },
      "http://localhost:3000",
      "127.0.0.1"
    );
    assert.equal(pwRes.ok, true);
    assert.equal(db.users.find((u) => u.id === 40).reset_token, null);
    assert.ok(db.login_sessions.find((s) => s.id === 1).logout_at !== null);
    assert.ok(db.login_sessions.find((s) => s.id === 2).logout_at !== null);
    assert.equal(
      db.login_sessions.find((s) => s.id === 3).logout_at,
      null,
      "Other users' login_sessions must remain untouched"
    );

    // Re-open a session for user 40, then verify PIN reset confirm also closes all open login_sessions
    db.login_sessions.push({ id: 4, user_id: 40, session_token: "sess-40-c", logout_at: null });
    const pinRes = await processPinResetService(
      supabase,
      {
        action: "confirm",
        token: rawPinToken,
        pin: "246810",
        confirm_pin: "246810",
      },
      "http://localhost:3000",
      "127.0.0.1"
    );
    assert.equal(pinRes.ok, true);
    assert.equal(db.users.find((u) => u.id === 40).pin_reset_token, null);
    assert.ok(db.login_sessions.find((s) => s.id === 4).logout_at !== null);
    assert.equal(db.login_sessions.find((s) => s.id === 3).logout_at, null);
  })
);

test(
  "6. Unauthenticated/invalid-user verify-otp, verify-pin, resend-otp return 401 (no 404 enumeration) and reject raw email (400)",
  withTestSecret(async () => {
    // Strict schemas reject raw email field (400)
    assert.equal(
      verifyOtpSchema.safeParse({ email: "victim@example.com", otp: "123456" }).success,
      false
    );
    assert.equal(
      verifyPinSchema.safeParse({ email: "victim@example.com", pin: "123456" }).success,
      false
    );
    assert.equal(
      resendOtpSchema.safeParse({ email: "victim@example.com" }).success,
      false
    );
    assert.equal(
      loginSchema.safeParse({ email: "victim@example.com", password: "Pass@123" }).success,
      false,
      "loginSchema must require captcha_token"
    );

    // Missing/invalid pending-MFA cookie returns null (routes return 401)
    assert.equal(verifyPendingMfaToken(undefined), null);
    const fullSessionCookie = signSession({
      userId: 50,
      role: "user",
      email: "user@example.com",
      sessionToken: "0123456789abcdef0123456789abcdef",
    });
    assert.equal(verifyPendingMfaToken(fullSessionCookie), null);

    // Service-level: nonexistent user, inactive user, or locked user all return 401 (never 404)
    const { supabase } = createAuthMockDb({
      users: [
        makeBaseUser({ id: 51, is_active: false }),
        makeBaseUser({ id: 52, is_locked: true, lock_until: null }),
      ],
    });

    for (const uid of [9999, 51, 52]) {
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
        () => verifyPinService(supabase, pendingPin, { pin: "123456" }, "http://localhost:3000", "127.0.0.1"),
        (err) => err.status === 401
      );
      await assert.rejects(
        () => resendOtpService(supabase, pendingOtp, "127.0.0.1"),
        (err) => err.status === 401
      );
    }
  })
);

test("7. No fallback secret in production: NODE_ENV='production' with SECRET_KEY unset throws", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevSecret = process.env.SECRET_KEY;
  const prevSupaSecret = process.env.SUPABASE_SECRET_KEY;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.SECRET_KEY;
    process.env.SUPABASE_SECRET_KEY = "should-not-be-used-in-production";

    assert.throws(
      () => getSigningSecret(),
      /SECRET_KEY/i,
      "Production must throw when SECRET_KEY is unset even if SUPABASE_SECRET_KEY is set"
    );

    // Non-production falls back to SUPABASE_SECRET_KEY when SECRET_KEY is unset
    process.env.NODE_ENV = "test";
    assert.equal(getSigningSecret(), "should-not-be-used-in-production");

    // Non-production with both unset also throws (no hardcoded fallback)
    delete process.env.SUPABASE_SECRET_KEY;
    assert.throws(() => getSigningSecret(), /SECRET_KEY/i);
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;

    if (prevSecret === undefined) delete process.env.SECRET_KEY;
    else process.env.SECRET_KEY = prevSecret;

    if (prevSupaSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = prevSupaSecret;
  }
});
