import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/register-x402dash-trust.yml", "utf8");

test("x402dash receives executable parameterized payment-verification URLs", () => {
  assert.match(workflow, /PREFLIGHT_URL: https:\/\/agentresolver\.vercel\.app\/api\/x402-payment-preflight\?url=/);
  assert.match(workflow, /GUARD_URL: https:\/\/agentresolver\.vercel\.app\/api\/payment-guard\?url=/);
  assert.match(workflow, /SETTLEMENT_VERIFY_URL: https:\/\/agentresolver\.vercel\.app\/api\/x402-settlement-verify\?txHash=/);
  assert.match(workflow, /--arg url "\$PREFLIGHT_URL"/);
  assert.match(workflow, /--arg url "\$GUARD_URL"/);
  assert.match(workflow, /--arg url "\$SETTLEMENT_VERIFY_URL"/);
  assert.match(workflow, /--data-urlencode "endpoint=\$GUARD_URL"/);
});

test("x402dash distribution stays free and sends no payment credentials", () => {
  assert.match(workflow, /https:\/\/api\.x402dash\.com\/v1\/register/);
  assert.match(workflow, /Register executable settlement verifier with x402dash/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE:/);
  assert.doesNotMatch(workflow, /X-Payment:/);
  assert.doesNotMatch(workflow, /Authorization:\s*Bearer/);
});

test("x402dash visibility audit requires settlement verifier alongside Guard and preflight", () => {
  assert.match(workflow, /agentresolver\.vercel\.app\/api\/x402-payment-preflight/);
  assert.match(workflow, /agentresolver\.vercel\.app\/api\/payment-guard/);
  assert.match(workflow, /agentresolver\.vercel\.app\/api\/x402-settlement-verify/);
});
