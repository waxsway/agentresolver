import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  ".github/workflows/x402scout-register-once.yml",
  "utf8"
);

test("x402Scout lane is zero-spend and uses only public AgentResolver data", () => {
  assert.match(workflow, /https:\/\/x402-discovery-api\.onrender\.com/);
  assert.match(workflow, /https:\/\/agentresolver\.vercel\.app\/api\/x402-ping/);
  assert.match(workflow, /0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8/);
  assert.match(workflow, /price_per_call: 0\.001/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE|X-PAYMENT|PRIVATE_KEY|SEED|MNEMONIC/i);
  assert.doesNotMatch(workflow, /email|contactEmail/i);
});

test("x402Scout registration is idempotent and outage-safe", () => {
  assert.match(workflow, /\$SCOUT_API\/catalog/);
  assert.match(workflow, /any\(\(\.endpoint_url \/\/ \.url \/\/ ""\) == \$endpoint\)/);
  assert.match(workflow, /already present in x402Scout/);
  assert.match(workflow, /200\|201/);
  assert.match(workflow, /409/);
  assert.match(workflow, /429\|500\|502\|503\|504\|000/);
});

test("x402Scout self-validation does not inflate buyer telemetry", () => {
  assert.match(workflow, /x-agentresolver-internal: 1/);
  assert.match(workflow, /\.x402Version == 2/);
  assert.match(workflow, /eip155:8453/);
  assert.match(workflow, /\.amount == "1000"/);
});

test("x402Scout publishes the input-free canary rather than a malformed Guard invocation", () => {
  assert.match(workflow, /ENDPOINT_URL: https:\/\/agentresolver\.vercel\.app\/api\/x402-ping/);
  assert.doesNotMatch(workflow, /ENDPOINT_URL: .*payment-guard/);
  assert.match(workflow, /canonical x402 payment preflight/);
});

test("x402Scout lane retries hourly while absent and remains manually retryable", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: "29 \\* \\* \\* \\*"/);
  assert.match(workflow, /paths:\n\s+- "\.github\/workflows\/x402scout-register-once\.yml"/);
});


test("x402Scout keeps the payout address a YAML string", () => {
  assert.match(
    workflow,
    /PAYOUT_WALLET: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"/
  );
  assert.doesNotMatch(
    workflow,
    /PAYOUT_WALLET: 0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8/
  );
});
