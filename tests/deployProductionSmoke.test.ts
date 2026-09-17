import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

test("production payment smoke supplies valid preflight input before expecting 402", () => {
  assert.match(
    workflow,
    /api\/x402-payment-preflight\?url=https%3A%2F%2Fexample\.com%2Fpaid&method=GET&maxPriceUsd=0\.01/
  );
  assert.doesNotMatch(
    workflow,
    /-w '%\{http_code\}' "\$BASE_URL\/api\/x402-payment-preflight" \|\| true/
  );
  assert.match(workflow, /\[ "\$code" = "402" \]/);
});
