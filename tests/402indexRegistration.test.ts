import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  ".github/workflows/402index-register-once.yml",
  "utf8"
);

test("402 Index lane registers the canonical Guard with a valid probe body", () => {
  assert.match(workflow, /https:\/\/402index\.io\/api\/v1/);
  assert.match(workflow, /https:\/\/agentresolver\.vercel\.app\/api\/x402-payment-preflight/);
  assert.match(workflow, /probe_body: \$probe/);
  assert.match(workflow, /https:\/\/agentresolver\.vercel\.app\/api\/x402-ping/);
  assert.match(workflow, /expectedNetwork/);
  assert.match(workflow, /eip155:8453/);
  assert.match(workflow, /http_method: "POST"/);
});

test("402 Index lane is zero-spend and anonymous", () => {
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE|X-PAYMENT|PRIVATE_KEY|SEED|MNEMONIC/i);
  assert.doesNotMatch(workflow, /contact_email|email:/i);
  assert.match(workflow, /provider: "AgentResolver"/);
  assert.match(workflow, /price_usd: 0\.001/);
  assert.match(workflow, /payment_asset: "USDC"/);
  assert.match(workflow, /payment_network: "Base"/);
});

test("402 Index validation is internal and fail-closed", () => {
  assert.match(workflow, /x-agentresolver-internal: 1/);
  assert.match(workflow, /test "\$code" = "402"/);
  assert.match(workflow, /\.x402Version == 2/);
  assert.match(workflow, /\.amount == "1000"/);
});

test("402 Index registration is idempotent and outage-safe", () => {
  assert.match(workflow, /services\?q=AgentResolver&protocol=x402&limit=100/);
  assert.match(workflow, /any\(\.url == \$url/);
  assert.match(workflow, /already visible in 402 Index/);
  assert.match(workflow, /200\|201/);
  assert.match(workflow, /422/);
  assert.match(workflow, /402\|429\|500\|502\|503\|504\|000/);
});

test("402 Index lane runs once on landing and can be retried manually", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /paths:\n\s+- "\.github\/workflows\/402index-register-once\.yml"/);
});
