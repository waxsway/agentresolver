import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Paywitness lane runs after successful main production deploys without paying", () => {
  const workflow = readFileSync(".github/workflows/register-paywitness-paid-canary-once.yml", "utf8");
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows: \["Deploy Production"\]/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /https:\/\/paywitness\.ai\/list/);
  assert.match(workflow, /https:\/\/paywitness\.ai\/preflight/);
  assert.match(workflow, /unexpectedly requested payment\. No payment was attempted/);
  assert.doesNotMatch(workflow, /payment-signature|x-payment|private.?key|seed phrase/i);
});

test("Paywitness self-list uses the canonical $0.001 settlement canary", () => {
  const workflow = readFileSync(".github/workflows/register-paywitness-paid-canary-once.yml", "utf8");
  assert.match(workflow, /https:\/\/agentresolver\.vercel\.app\/api\/x402-ping/);
  assert.match(workflow, /str\(item\.get\("amount"\)\) == "1000"/);
  assert.match(workflow, /0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8/);
});


test("Paywitness lane marks its AgentResolver self-probe internal", () => {
  const workflow = readFileSync(".github/workflows/register-paywitness-paid-canary-once.yml", "utf8");
  assert.match(workflow, /x-agentresolver-internal: 1/);
});
