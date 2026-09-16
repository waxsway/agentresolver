import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("settlement history collector validates its fail-closed invariants", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/collect-settlement-history.mjs", "--self-test"],
    { cwd: process.cwd(), encoding: "utf8" }
  );
  assert.match(output, /settlement-history self-test PASSED/);
});
