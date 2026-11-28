import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CIRCULATION_POLICY as CANONICAL_POLICY } from "../../src/lib/circulation/policy.ts";
import { CIRCULATION_RULES } from "../../src/lib/circulation/rules.ts";
import { CIRCULATION_POLICY as TYPES_POLICY } from "../../src/components/circulation/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const policyFilePath = path.resolve(__dirname, "../../src/lib/circulation/policy.ts");

test("circulation policy stays in sync across policy.ts, rules.ts, and components/circulation/types.ts", () => {
  assert.deepStrictEqual(CIRCULATION_RULES, CANONICAL_POLICY);
  assert.deepStrictEqual(TYPES_POLICY, CANONICAL_POLICY);
  assert.deepStrictEqual(CIRCULATION_RULES, TYPES_POLICY);

  const allKeys = Array.from(
    new Set([
      ...Object.keys(CANONICAL_POLICY),
      ...Object.keys(CIRCULATION_RULES),
      ...Object.keys(TYPES_POLICY),
    ])
  ).sort();

  assert.deepStrictEqual(Object.keys(CIRCULATION_RULES).sort(), Object.keys(CANONICAL_POLICY).sort());
  assert.deepStrictEqual(Object.keys(TYPES_POLICY).sort(), Object.keys(CANONICAL_POLICY).sort());

  for (const key of allKeys) {
    assert.strictEqual(
      CIRCULATION_RULES[key],
      CANONICAL_POLICY[key],
      `CIRCULATION_RULES.${key} drifted from CIRCULATION_POLICY.${key}`
    );
    assert.strictEqual(
      TYPES_POLICY[key],
      CANONICAL_POLICY[key],
      `types.ts CIRCULATION_POLICY.${key} drifted from policy.ts CIRCULATION_POLICY.${key}`
    );
  }
});

test("src/lib/circulation/policy.ts has zero import or require statements", () => {
  const source = fs.readFileSync(policyFilePath, "utf8");
  assert.equal(/^\s*import\b/m.test(source), false, "policy.ts must not contain import declarations");
  assert.equal(/\bimport\s*\(/m.test(source), false, "policy.ts must not contain dynamic import()");
  assert.equal(/\brequire\s*\(/m.test(source), false, "policy.ts must not contain require()");
  assert.equal(/\bfrom\s+["']/m.test(source), false, "policy.ts must not import from modules");
});
