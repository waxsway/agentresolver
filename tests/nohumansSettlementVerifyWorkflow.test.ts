import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/submit-nohumans-payment-guard.yml", "utf8");

test("NoHumans receives the executable settlement verifier without operator payment", () => {
  assert.match(
    workflow,
    /SETTLEMENT_VERIFY_URL: https:\/\/agentresolver\.vercel\.app\/api\/x402-settlement-verify\?txHash=/
  );
  assert.match(workflow, /Submit settlement verifier to NoHumans free verification queue/);
  assert.match(workflow, /endpoint_url:\$endpoint/);
  assert.match(workflow, /price_amount:0\.001/);
  assert.match(workflow, /chains:\["base","solana"\]/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE:/);
  assert.doesNotMatch(workflow, /Authorization:\s*Bearer/);
});

test("NoHumans settlement verifier probe validates only the unpaid 402 contract", () => {
  assert.match(workflow, /Verify paid settlement verifier example without spending/);
  assert.match(workflow, /test "\$code" = "402"/);
  assert.match(workflow, /item\.get\("network"\) == "eip155:8453"/);
  assert.match(workflow, /str\(item\.get\("amount"\)\) == "1000"/);
});
