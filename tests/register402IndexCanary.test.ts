import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("402 Index workflow registers only the proven paid canary without secrets or spending", () => {
  const workflow = readFileSync(".github/workflows/register-402index-paid-canary.yml", "utf8");
  assert.match(workflow, /ENDPOINT_URL: https:\/\/agentresolver\.vercel\.app\/api\/x402-ping/);
  assert.match(workflow, /https:\/\/402index\.io\/api\/v1\/register/);
  assert.match(workflow, /protocol:"x402"/);
  assert.match(workflow, /http_method:"GET"/);
  assert.match(workflow, /price_usd:0\.001/);
  assert.match(workflow, /payment_asset:"USDC"/);
  assert.match(workflow, /payment_network:"Base"/);
  assert.match(workflow, /agent-tools\/x402/);
  assert.match(workflow, /extensions.*agentresolver/);
  assert.doesNotMatch(workflow, /PRIVATE_KEY|SEED|MNEMONIC|PAYMENT-SIGNATURE|X-PAYMENT/);
});
