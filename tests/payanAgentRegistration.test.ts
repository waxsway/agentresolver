import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/register-payanagent-once.yml", "utf8");

test("PayanAgent lane is free, no-email, and uses only the public payout address", () => {
  assert.match(workflow, /https:\/\/payanagent\.com\/api\/v1\/agents/);
  assert.match(workflow, /https:\/\/payanagent\.com\/api\/v1\/offers/);
  assert.match(workflow, /0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8/);
  assert.doesNotMatch(workflow, /ownerEmail/);
  assert.doesNotMatch(workflow, /priceCents/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE|X-PAYMENT|private.?key|seed phrase/i);
});

test("PayanAgent registration is idempotent and publishes both buyer funnel stages", () => {
  assert.match(workflow, /q=AgentResolver/);
  assert.match(workflow, /agentresolver\.vercel\.app/);
  assert.match(workflow, /refusing to create a duplicate provider/);
  assert.match(workflow, /AgentResolver Settlement Ping/);
  assert.match(workflow, /AgentResolver Guard — Verify x402 Before Paying/);
  assert.match(workflow, /externalUrl": "https:\/\/agentresolver\.vercel\.app\/api\/x402-ping"/);
  assert.match(workflow, /externalUrl": "https:\/\/agentresolver\.vercel\.app\/api\/payment-guard"/);
  assert.match(workflow, /expectedNetwork": "eip155:8453"/);
});


test("PayanAgent lane marks its AgentResolver self-probe internal", () => {
  assert.match(workflow, /x-agentresolver-internal: 1/);
});


test("PayanAgent lane fails closed when the catalog idempotency check is unavailable", () => {
  assert.match(workflow, /refusing to create a provider without an idempotency check/);
  assert.match(workflow, /echo "already_listed=true" >> "\$GITHUB_OUTPUT"/);
  assert.match(workflow, /--retry 4 --retry-delay 2 --retry-all-errors/);
});
