import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/audit-circle-x402-discovery.yml", "utf8");

test("Circle discovery audit is public, zero-spend, and targets wallet-capable discovery", () => {
  assert.match(workflow, /https:\/\/api\.circle\.com\/v2\/x402\/discovery\/resources/);
  assert.match(workflow, /query": "AgentResolver"/);
  assert.match(workflow, /category": "INFRASTRUCTURE"/);
  assert.match(workflow, /network": "base"/);
  assert.match(workflow, /maxUsdPrice": "0\.01"/);
  assert.match(workflow, /Public\/keyless lookup only/);
  assert.match(workflow, /no wallet action and no payment attempted/);
  assert.doesNotMatch(workflow, /Authorization:|API_KEY|PRIVATE_KEY|PAYMENT-SIGNATURE/);
});
