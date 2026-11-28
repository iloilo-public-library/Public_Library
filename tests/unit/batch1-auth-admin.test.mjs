import test from "node:test";
import assert from "node:assert/strict";
import {
  loginSchema,
  signupSchema,
  resetPasswordRequestSchema,
  resetPinRequestSchema,
  verifyOtpSchema,
  verifyPinSchema,
  verifyCaptchaSchema,
  qrPostSchema,
} from "../../src/validators/auth.ts";
import {
  adminQuerySchema,
  adminMutationSchema,
  adminUpdateProfileSchema,
  adminChangePasswordSchema,
  adminToggleSecuritySchema,
  adminSetPinSchema,
  staffAppearanceSchema,
} from "../../src/validators/admin.ts";
import {
  signSession,
  verifySession,
  createSessionToken,
} from "../../src/lib/auth/session.ts";
import {
  hasRole,
  isStaffRole,
  isAdminRole,
} from "../../src/lib/auth/rbac.ts";
import {
  clearRateLimitMemory,
  enforceRateLimit,
} from "../../src/lib/auth/rate-limit.ts";
import {
  formatZodError,
  getManilaLastNDays,
  mapDatabaseError,
  RateLimitError,
  toManilaDateKey,
} from "../../src/lib/errors.ts";

test("1. Strict Zod validation rejects unknown fields across Batch 1 auth and admin schemas", () => {
  const loginRes = loginSchema.safeParse({
    email: "admin@iloilolibrary.gov.ph",
    password: "Admin@123",
    captcha_token: "valid-captcha-token-123456",
    extraField: "hack",
  });
  assert.equal(loginRes.success, false);
  const formattedLogin = formatZodError(loginRes.error);
  assert.ok(formattedLogin.message.includes("extraField"));

  const profileRes = adminUpdateProfileSchema.safeParse({
    firstname: "Anthony",
    lastname: "Ojera",
    gender: "Male",
    phone_number: "09171234567",
    role: "admin",
  });
  assert.equal(profileRes.success, false);

  const appearanceRes = staffAppearanceSchema.safeParse({
    theme: "dark",
    language: "english",
    unknownPref: true,
  });
  assert.equal(appearanceRes.success, false);

  const queryRes = adminQuerySchema.safeParse({
    resource: "admin_profile",
    unexpectedParam: "1",
  });
  assert.equal(queryRes.success, false);

  const mutationRes = adminMutationSchema.safeParse({
    resource: "admin_profile",
    action: "update_profile",
    payload: {},
    extraRoot: 123,
  });
  assert.equal(mutationRes.success, false);
});

test("2. Admin Settings validation enforces legacy name, phone, password complexity, and 6-digit PIN rules", () => {
  // Valid profile update collapses extra whitespace
  const validProfile = adminUpdateProfileSchema.safeParse({
    firstname: "  Anthony   Jr. ",
    lastname: " Ojera ",
    gender: "Male",
    phone_number: "+63 917 123 4567",
  });
  assert.equal(validProfile.success, true);
  assert.equal(validProfile.data.firstname, "Anthony Jr.");
  assert.equal(validProfile.data.lastname, "Ojera");

  // Invalid name with digits
  const badName = adminUpdateProfileSchema.safeParse({
    firstname: "Anthony123",
    lastname: "Ojera",
  });
  assert.equal(badName.success, false);

  // Invalid phone (<7 digits)
  const badPhone = adminUpdateProfileSchema.safeParse({
    firstname: "Anthony",
    lastname: "Ojera",
    phone_number: "12345",
  });
  assert.equal(badPhone.success, false);

  // Password complexity & confirmation match
  const weakPw = adminChangePasswordSchema.safeParse({
    current_password: "OldPassword@1",
    new_password: "weakpassword",
    confirm_password: "weakpassword",
  });
  assert.equal(weakPw.success, false);

  const mismatchPw = adminChangePasswordSchema.safeParse({
    current_password: "OldPassword@1",
    new_password: "StrongPassword@1",
    confirm_password: "StrongPassword@2",
  });
  assert.equal(mismatchPw.success, false);

  const validPw = adminChangePasswordSchema.safeParse({
    current_password: "OldPassword@1",
    new_password: "StrongPassword@1",
    confirm_password: "StrongPassword@1",
  });
  assert.equal(validPw.success, true);

  // 6-digit PIN validation
  const badPin = adminSetPinSchema.safeParse({
    password: "StrongPassword@1",
    pin: "12345",
    confirm: "12345",
  });
  assert.equal(badPin.success, false);

  const validPin = adminSetPinSchema.safeParse({
    password: "StrongPassword@1",
    pin: "654321",
    confirm: "654321",
  });
  assert.equal(validPin.success, true);

  // Security toggle validation
  assert.equal(
    adminToggleSecuritySchema.safeParse({ method: "otp", enabled: true }).success,
    true
  );
  assert.equal(
    adminToggleSecuritySchema.safeParse({ method: "biometric", enabled: true }).success,
    false
  );
});

test("3. Auth validators enforce signup, OTP, PIN, CAPTCHA, QR, and reset rules", () => {
  // Member signup requires valid age (7-120), gender, phone, and strong password
  const memberSignupFail = signupSchema.safeParse({
    firstname: "Juan",
    lastname: "Dela Cruz",
    age: "5",
    gender: "Male",
    phone: "09171234567",
    email: "juan@example.com",
    password: "StrongPassword@1",
    confirm_password: "StrongPassword@1",
  });
  assert.equal(memberSignupFail.success, false);

  const memberSignupOk = signupSchema.safeParse({
    firstname: "Juan",
    lastname: "Dela Cruz",
    age: "21",
    gender: "Male",
    phone: "09171234567",
    email: "juan@example.com",
    password: "StrongPassword@1",
    confirm_password: "StrongPassword@1",
  });
  assert.equal(memberSignupOk.success, true);

  // OTP supports both 6-digit numeric and legacy 6-char alphanumeric (3 letters + 3 digits)
  assert.equal(verifyOtpSchema.safeParse({ otp: "123456" }).success, true);
  assert.equal(verifyOtpSchema.safeParse({ otp: "xkb492" }).success, true);
  assert.equal(verifyOtpSchema.safeParse({ otp: "12345" }).success, false);

  assert.equal(verifyPinSchema.safeParse({ pin: "123456" }).success, true);
  assert.equal(verifyPinSchema.safeParse({ pin: "abcdef" }).success, false);

  assert.equal(
    verifyCaptchaSchema.safeParse({ token: "valid-token-12345", answer: "12" }).success,
    true
  );

  assert.equal(
    qrPostSchema.safeParse({ action: "generate" }).success,
    true
  );
  assert.equal(
    qrPostSchema.safeParse({ action: "confirm", token: "short" }).success,
    false
  );

  assert.equal(
    resetPasswordRequestSchema.safeParse({
      action: "confirm",
      token: "0123456789abcdef0123456789abcdef",
      new_password: "StrongPassword@1",
      confirm_password: "StrongPassword@1",
    }).success,
    true
  );
  assert.equal(
    resetPinRequestSchema.safeParse({
      action: "confirm",
      token: "0123456789abcdef0123456789abcdef",
      pin: "123456",
      confirm_pin: "123456",
    }).success,
    true
  );
});

test("4. Session signing, tamper rejection, and RBAC role guards work deterministically", () => {
  const prevSecret = process.env.SECRET_KEY;
  process.env.SECRET_KEY = "unit-test-signing-secret-key-0123456789";
  try {
    const sessionToken = createSessionToken();
    assert.equal(sessionToken.length, 32);

    const signed = signSession({
      userId: 1,
      role: "admin",
      email: "anthonyojera47@gmail.com",
      sessionToken,
    });

    const verified = verifySession(signed);
    assert.ok(verified);
    assert.equal(verified.userId, 1);
    assert.equal(verified.role, "admin");
    assert.equal(verified.sessionToken, sessionToken);

    // Tampered signature must be rejected
    const tampered = `${signed.slice(0, -3)}abc`;
    assert.equal(verifySession(tampered), null);

    // Role helpers
    assert.equal(isAdminRole("admin"), true);
    assert.equal(isAdminRole("librarian"), false);
    assert.equal(isStaffRole("admin"), true);
    assert.equal(isStaffRole("librarian"), true);
    assert.equal(isStaffRole("user"), false);

    const userSession = {
      userId: 73,
      role: "user",
      email: "juan@example.com",
      sessionToken,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    assert.equal(hasRole(userSession, ["admin", "librarian"]), false);
    assert.equal(hasRole(verified, ["admin", "librarian"]), true);
  } finally {
    if (prevSecret === undefined) {
      delete process.env.SECRET_KEY;
    } else {
      process.env.SECRET_KEY = prevSecret;
    }
  }
});

test("5. Abuse rate limiter blocks after maxAttempts and reports retryAfterSec", async () => {
  clearRateLimitMemory();

  for (let i = 0; i < 3; i++) {
    await enforceRateLimit({
      scope: "test:login",
      identifier: "127.0.0.1:test@example.com",
      maxAttempts: 3,
      windowSeconds: 60,
      blockSeconds: 120,
    });
  }

  await assert.rejects(
    async () => {
      await enforceRateLimit({
        scope: "test:login",
        identifier: "127.0.0.1:test@example.com",
        maxAttempts: 3,
        windowSeconds: 60,
        blockSeconds: 120,
      });
    },
    (err) => {
      assert.ok(err instanceof RateLimitError);
      assert.equal(err.status, 429);
      assert.ok(err.retryAfterSec > 0 && err.retryAfterSec <= 120);
      return true;
    }
  );

  clearRateLimitMemory();
});

test("6. Asia/Manila day boundaries and database error mapping behave accurately", () => {
  // 2026-11-25T18:30:00Z is 2026-11-26 02:30:00 in Asia/Manila (+08:00)
  const utcLateNight = new Date("2026-11-25T18:30:00.000Z");
  assert.equal(toManilaDateKey(utcLateNight), "2026-11-26");

  const last7 = getManilaLastNDays(7, utcLateNight);
  assert.equal(last7.length, 7);
  assert.equal(last7[0], "2026-11-20");
  assert.equal(last7[6], "2026-11-26");

  // Database error mapping hides raw SQL details
  const dupEmailErr = mapDatabaseError({
    code: "23505",
    message: 'duplicate key value violates unique constraint "users_username_key"',
  });
  assert.equal(dupEmailErr.status, 409);
  assert.equal(dupEmailErr.message, "An account with this email already exists.");

  const fkErr = mapDatabaseError({
    code: "23503",
    message: 'update or delete on table "books" violates foreign key constraint',
  });
  assert.equal(fkErr.status, 409);

  const checkErr = mapDatabaseError({
    code: "23514",
    message: 'new row for relation "book_copies" violates check constraint',
  });
  assert.equal(checkErr.status, 400);
});
