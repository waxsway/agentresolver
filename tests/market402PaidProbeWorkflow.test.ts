import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/market402-paid-probe-optin.yml", "utf8");

test("Market402 probes executable Guard resources instead of invalid bare routes", () => {
  assert.match(workflow, /GUARD_URL: https:\/\/agentresolver\.vercel\.app\/api\/payment-guard\?url=/);
  assert.match(workflow, /PREFLIGHT_URL: https:\/\/agentresolver\.vercel\.app\/api\/x402-payment-preflight\?url=/);
  assert.match(workflow, /--arg url "\$PREFLIGHT_URL" '\{url:\$url\}'/);
  assert.match(workflow, /--arg url "\$GUARD_URL" '\{url:\$url\}'/);
  assert.match(workflow, /Market402 canonical preflight verdict is/);
  assert.match(workflow, /Market402 Guard verdict is/);
  assert.doesNotMatch(workflow, /--data '\{"url":"https:\/\/agentresolver\.vercel\.app\/api\/x402-payment-preflight"\}'/);
  assert.doesNotMatch(workflow, /--data '\{"url":"https:\/\/agentresolver\.vercel\.app\/api\/payment-guard"\}'/);
});

test("Market402 paid-probe submissions bind to the exact executable resource URL", () => {
  assert.match(workflow, /--arg resource "\$PREFLIGHT_URL"/);
  assert.match(workflow, /--arg resource "\$GUARD_URL"/);
  assert.match(workflow, /declared_price_usd:0\.001/);
  assert.match(workflow, /paid_probe_optin:true/);
  assert.doesNotMatch(workflow, /"sample_input"/);
});
