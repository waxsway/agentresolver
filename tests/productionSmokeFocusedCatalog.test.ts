import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const smoke = readFileSync(".github/workflows/production-smoke.yml", "utf8");

test("production smoke enforces the focused public revenue catalog", () => {
  assert.match(smoke, /index\("x402-ping"\) != null/);
  assert.match(smoke, /index\("x402-payment-preflight"\) != null/);
  assert.match(smoke, /index\("verified-resolve"\) != null/);
  assert.match(smoke, /index\("batch-verified-resolve"\) != null/);
  assert.match(smoke, /index\("hash-encode"\) == null/);
  assert.match(smoke, /index\("mcp-probe"\) == null/);
});
