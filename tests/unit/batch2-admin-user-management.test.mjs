import test from "node:test";
import assert from "node:assert/strict";
import {
  accountCreateSchema,
  accountResetPasswordSchema,
  accountToggleActiveSchema,
  accountRequestReviewSchema,
  adminUsersQuerySchema,
} from "../../src/validators/admin.ts";
import {
  assertNotOwnAccount,
  assertLibrarianRenewalOnly,
  AdminMutationError,
} from "../../src/repositories/shared.ts";

test("1. Batch 2 account schemas reject unknown fields", () => {
  const createExtra = accountCreateSchema.safeParse({
    firstname: "Juan",
    lastname: "Dela Cruz",
    email: "juan@example.com",
    password: "StrongPassword@1",
    role: "user",
    is_admin: true,
  });
  assert.equal(createExtra.success, false);

  const reviewExtra = accountRequestReviewSchema.safeParse({
    note: "Approved",
    unknown_field: true,
  });
  assert.equal(reviewExtra.success, false);
});

test("2. Batch 2 account and user query payloads enforce valid values", () => {
  assert.equal(
    accountCreateSchema.safeParse({
      firstname: "Juan",
      lastname: "Dela Cruz",
      email: "juan@example.com",
      password: "StrongPassword@1",
      role: "librarian",
    }).success,
    true
  );

  assert.equal(
    accountResetPasswordSchema.safeParse({
      new_password: "weak",
    }).success,
    false
  );

  assert.equal(
    accountToggleActiveSchema.safeParse({ is_active: true }).success,
    true
  );
  assert.equal(
    accountToggleActiveSchema.safeParse({ is_active: "yes" }).success,
    false
  );

  assert.equal(
    adminUsersQuerySchema.safeParse({
      role: "member",
      mode: "picker",
      q: "Juan",
      limit: 8,
    }).success,
    true
  );
  assert.equal(
    adminUsersQuerySchema.safeParse({
      role: "member",
      mode: "picker",
      limit: 201,
    }).success,
    false
  );
});

test("3. Admin cannot deactivate or delete their own account", () => {
  assert.throws(
    () => assertNotOwnAccount(42, 42, "delete"),
    (error) =>
      error instanceof AdminMutationError &&
      error.status === 400 &&
      error.message.includes("delete")
  );
  assert.throws(
    () => assertNotOwnAccount(42, 42, "deactivate"),
    (error) =>
      error instanceof AdminMutationError &&
      error.status === 400 &&
      error.message.includes("deactivate")
  );
  assert.doesNotThrow(() => assertNotOwnAccount(42, 43, "deactivate"));
});

test("4. Librarians are restricted to renewal account requests at repository level", () => {
  assert.doesNotThrow(() =>
    assertLibrarianRenewalOnly("librarian", "renew")
  );
  assert.throws(
    () => assertLibrarianRenewalOnly("librarian", "register"),
    (error) =>
      error instanceof AdminMutationError &&
      error.status === 403 &&
      error.message.includes("renewal")
  );
  assert.doesNotThrow(() =>
    assertLibrarianRenewalOnly("admin", "register")
  );
});
