import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/register-x402dash-trust.yml", "utf8");

test("x402dash registers executable Guard and preflight URLs", () => {
  assert.match(workflow, /PREFLIGHT_URL: https:\/\/agentresolver\.vercel\.app\/api\/x402-payment-preflight\?url=/);
  assert.match(workflow, /GUARD_URL: https:\/\/agentresolver\.vercel\.app\/api\/payment-guard\?url=/);
  assert.match(workflow, /--arg url "\$PREFLIGHT_URL"/);
  assert.match(workflow, /--arg url "\$GUARD_URL"/);
  assert.match(workflow, /--data-urlencode "endpoint=\$GUARD_URL"/);
  assert.doesNotMatch(workflow, /"url":"https:\/\/agentresolver\.vercel\.app\/api\/payment-guard"/);
  assert.doesNotMatch(workflow, /"url":"https:\/\/agentresolver\.vercel\.app\/api\/x402-payment-preflight"/);
});

test("x402dash receives the executable settlement verifier", () => {
  assert.match(workflow, /SETTLEMENT_VERIFY_URL: https:\/\/agentresolver\.vercel\.app\/api\/x402-settlement-verify\?txHash=/);
  assert.match(workflow, /Register settlement verifier with x402dash/);
  assert.match(workflow, /--arg url "\$SETTLEMENT_VERIFY_URL"/);
  assert.match(workflow, /--data-urlencode "endpoint=\$SETTLEMENT_VERIFY_URL"/);
  assert.match(workflow, /agentresolver\.vercel\.app\/api\/x402-settlement-verify/);
});

test("x402dash workflow never signs or spends on operator behalf", () => {
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE:/);
  assert.doesNotMatch(workflow, /X-PAYMENT:/);
  assert.doesNotMatch(workflow, /Authorization:\s*Bearer/);
  assert.doesNotMatch(workflow, /private[_-]?key/i);
});
