import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  ".github/workflows/register-tollbooth-once.yml",
  "utf8"
);

test("Tollbooth registration lane is zero-spend and anonymous", () => {
  assert.match(workflow, /https:\/\/www\.trytollbooth\.com/);
  assert.match(workflow, /https:\/\/agentresolver\.vercel\.app\/api\/cdp-payment-guard/);
  assert.match(workflow, /0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8/);
  assert.match(workflow, /priceUsdc: 0\.002/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE|X-PAYMENT|PRIVATE_KEY|SEED|MNEMONIC/i);
  assert.doesNotMatch(workflow, /email|contactEmail|ownerEmail/i);
});

test("Tollbooth self-validation matches the external CDP Guard contract", () => {
  assert.match(workflow, /Validate live Coinbase-CDP Guard challenge/);
  assert.match(workflow, /\.x402Version == 2/);
  assert.match(workflow, /\.network == "eip155:8453"/);
  assert.match(workflow, /\.amount == "2000"/);
  assert.match(workflow, /\.scheme == "exact"/);
  assert.doesNotMatch(workflow, /x-agentresolver-internal: 1/);
});

test("Tollbooth registration uses the live CDP Guard and public Base payout", () => {
  assert.match(
    workflow,
    /ENDPOINT_URL: "https:\/\/agentresolver\.vercel\.app\/api\/cdp-payment-guard\?url=/
  );
  assert.match(workflow, /method=GET"/);
  assert.match(workflow, /PAYOUT_WALLET: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"/);
  assert.match(workflow, /chain: "base"/);
  assert.match(workflow, /category: "developer-tools"/);
  assert.match(workflow, /AgentResolver CDP Payment Guard/);
});

test("Tollbooth lane is idempotent, bounded, and outage-safe", () => {
  assert.match(workflow, /\/api\/services\?q=AgentResolver/);
  assert.match(workflow, /already present in Tollbooth/);
  assert.match(workflow, /200\|201\|202/);
  assert.match(workflow, /409/);
  assert.match(workflow, /429\|500\|502\|503\|504\|000/);
  assert.match(workflow, /verificationStatus/);
  assert.doesNotMatch(workflow, /cat \/tmp\/tollbooth-register\.json/);
});

test("Tollbooth lane retries hourly while absent and remains manually retryable", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.ok(workflow.includes('    - cron: "17 * * * *"'));
  assert.match(
    workflow,
    /paths:\n\s+- "\.github\/workflows\/register-tollbooth-once\.yml"/
  );
});
