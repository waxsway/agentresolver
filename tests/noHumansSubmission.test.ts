import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("NoHumans workflow queues the proven ping, Guard, preflight, and targeted hash utility without buyer secrets", () => {
  const workflow = readFileSync(".github/workflows/submit-nohumans-payment-guard.yml", "utf8");
  assert.match(workflow, /PING_URL: https:\/\/agentresolver\.vercel\.app\/api\/x402-ping/);
  assert.match(workflow, /GUARD_URL: https:\/\/agentresolver\.vercel\.app\/api\/payment-guard\?/);
  assert.match(workflow, /Verify proven paid ping without spending/);
  assert.match(workflow, /Resubmit proven paid ping to NoHumans free verification queue/);
  assert.match(workflow, /AgentResolver x402 Settlement Test/);
  assert.match(workflow, /PREFLIGHT_URL: https:\/\/agentresolver\.vercel\.app\/api\/x402-payment-preflight\?/);
  assert.match(workflow, /HASH_URL: https:\/\/agentresolver\.vercel\.app\/api\/hash-encode\?operation=sha256&input=agentresolver/);
  assert.match(workflow, /Submit Guard to NoHumans free verification queue/);
  assert.match(workflow, /Submit canonical preflight to NoHumans free verification queue/);
  assert.match(workflow, /Verify paid hash utility without spending/);
  assert.match(workflow, /Submit hash utility to NoHumans free verification queue/);
  assert.match(workflow, /price_amount:0\.001/);
  assert.match(workflow, /chains:\["base","solana"\]/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE|private.?key|seed phrase/i);
});


test("NoHumans submission waits for production deployment", () => {
  const workflow = readFileSync(".github/workflows/submit-nohumans-payment-guard.yml", "utf8");
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows: \["Deploy Production"\]/);
  assert.doesNotMatch(workflow, /^  push:/m);
});


test("NoHumans queues the GET-first settlement verifier without signing or spending", () => {
  const workflow = readFileSync(".github/workflows/submit-nohumans-payment-guard.yml", "utf8");
  assert.match(workflow, /SETTLEMENT_VERIFY_URL: https:\/\/agentresolver\.vercel\.app\/api\/x402-settlement-verify\?txHash=/);
  assert.match(workflow, /Verify paid settlement verifier example without spending/);
  assert.match(workflow, /Submit settlement verifier to NoHumans free verification queue/);
  assert.match(workflow, /AgentResolver x402 Settlement Verify/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE/);
});
