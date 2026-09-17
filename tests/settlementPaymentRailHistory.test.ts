import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("settlement payment rail annotator self-test passes", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/annotate-settlement-payment-rail.mjs", "--self-test"],
    { encoding: "utf8" }
  );
  assert.match(output, /self-test PASSED/);
});
