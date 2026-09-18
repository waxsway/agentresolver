import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("NoHumans workflow queues Guard, canonical preflight, and a paid GET utility without buyer secrets", () => {
  const workflow = readFileSync(".github/workflows/submit-nohumans-payment-guard.yml", "utf8");
  assert.match(workflow, /GUARD_URL: https:\/\/agentresolver\.vercel\.app\/api\/payment-guard\?/);
  assert.match(workflow, /PREFLIGHT_URL: https:\/\/agentresolver\.vercel\.app\/api\/x402-payment-preflight\?/);
  assert.match(workflow, /HASH_URL: https:\/\/agentresolver\.vercel\.app\/api\/hash-encode\?operation=sha256&input=agentresolver/);
  assert.match(workflow, /Submit Guard to NoHumans free verification queue/);
  assert.match(workflow, /Submit canonical preflight to NoHumans free verification queue/);
  assert.match(workflow, /Verify paid hash utility without spending/);
  assert.match(workflow, /Submit hash utility to NoHumans free verification queue/);
  assert.match(workflow, /hmac-sha256.*POST-only/i);
  assert.match(workflow, /price_amount:0\.001/);
  assert.match(workflow, /chains:\["base","solana"\]/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE|private.?key|seed phrase/i);
});
