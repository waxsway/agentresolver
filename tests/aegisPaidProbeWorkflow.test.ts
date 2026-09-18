import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Aegis paid-delivery probe lane uses bounded zero-spend retries without deploy fan-out", () => {
  const workflow = readFileSync(".github/workflows/register-aegis-paid-canary-once.yml", "utf8");
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: "11 \*\/12 \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /workflow_run:/);
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


test("Aegis external outages defer safely instead of failing or paying", () => {
  const workflow = readFileSync(".github/workflows/register-aegis-paid-canary-once.yml", "utf8");
  assert.match(workflow, /429\|500\|502\|503\|504\|530\|000/);
  assert.match(workflow, /touch \/tmp\/aegis-unavailable/);
  assert.match(workflow, /scheduled zero-spend audit will retry/);
  assert.match(workflow, /advertised lint as free but returned 402\. No payment was attempted/);
  assert.match(workflow, /advertised discovery as free but returned 402\. No payment was attempted/);
});


test("Aegis lane marks its AgentResolver self-probe internal", () => {
  const workflow = readFileSync(".github/workflows/register-aegis-paid-canary-once.yml", "utf8");
  assert.match(workflow, /x-agentresolver-internal: 1/);
});
