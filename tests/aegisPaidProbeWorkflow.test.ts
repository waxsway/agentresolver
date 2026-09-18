import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Aegis paid-delivery probe lane retries after successful production deploys without spending", () => {
  const workflow = readFileSync(".github/workflows/register-aegis-paid-canary-once.yml", "utf8");
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows: \["Deploy Production"\]/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /https:\/\/aegis\.borisinc\.com\/submit/);
  assert.match(workflow, /https:\/\/aegis\.borisinc\.com\/lint/);
  assert.match(workflow, /https:\/\/aegis\.borisinc\.com\/discover/);
  assert.match(workflow, /Aegis registration is paid; no payment was attempted/);
  assert.doesNotMatch(workflow, /payment-signature|x-payment|private.?key|seed phrase/i);
});

test("Aegis lane submits the canonical $0.001 Base canary", () => {
  const workflow = readFileSync(".github/workflows/register-aegis-paid-canary-once.yml", "utf8");
  assert.match(workflow, /https:\/\/agentresolver\.vercel\.app\/api\/x402-ping/);
  assert.match(workflow, /price_usd=0\.001/);
  assert.match(workflow, /item\.get\("network"\) == "eip155:8453"/);
  assert.match(workflow, /str\(item\.get\("amount"\)\) == "1000"/);
});


test("Aegis provider outages do not fail the zero-spend lane", () => {
  const workflow = readFileSync(".github/workflows/register-aegis-paid-canary-once.yml", "utf8");
  assert.match(workflow, /530\|000/);
  assert.match(workflow, /temporarily unavailable/);
  assert.match(workflow, /touch \/tmp\/aegis-unavailable/);
  assert.match(workflow, /Skipping Aegis discovery because its lint surface is unavailable/);
  assert.match(workflow, /free lint unexpectedly requested payment\. No payment was attempted/);
});
