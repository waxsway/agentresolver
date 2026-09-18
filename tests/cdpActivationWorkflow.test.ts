import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/activate-cdp-x402-ping.yml", "utf8");
const health = readFileSync("src/app/api/health/route.ts", "utf8");

test("CDP activation stays dormant until both Coinbase API credentials exist", () => {
  assert.match(workflow, /CDP_API_KEY_ID: \$\{\{ secrets\.CDP_API_KEY_ID \}\}/);
  assert.match(workflow, /CDP_API_KEY_SECRET: \$\{\{ secrets\.CDP_API_KEY_SECRET \}\}/);
  assert.match(workflow, /Coinbase CDP credentials are not configured\. CDP remains disabled/);
  assert.match(workflow, /ready=false/);
});

test("CDP activation is bounded to x402-ping and does not enable Circle", () => {
  assert.match(workflow, /AGENTRESOLVER_CDP_FACILITATOR_ENABLED/);
  assert.match(workflow, /"value": "1"/);
  assert.match(workflow, /AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES/);
  assert.match(workflow, /"value": "x402-ping"/);
  assert.match(workflow, /Circle Gateway is enabled in canonical production\. Refusing CDP activation/);
  assert.doesNotMatch(workflow, /"key": "AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED"/);
});

test("CDP credential values are sent only as sensitive Vercel environment entries", () => {
  assert.match(workflow, /"key": "CDP_API_KEY_ID",[\s\S]*?"type": "sensitive"/);
  assert.match(workflow, /"key": "CDP_API_KEY_SECRET",[\s\S]*?"type": "sensitive"/);
  assert.match(workflow, /\/v10\/projects\/\$VERCEL_PROJECT_ID\/env\?upsert=true&teamId=\$VERCEL_ORG_ID/);
  assert.doesNotMatch(workflow, /echo "\$CDP_API_KEY_SECRET"/);
  assert.doesNotMatch(workflow, /private.?key|seed phrase/i);
});

test("CDP activation rechecks main and verifies a real unsigned production challenge", () => {
  assert.match(workflow, /git ls-remote origin refs\/heads\/main/);
  assert.match(workflow, /Refusing to deploy stale code/);
  assert.match(workflow, /vercel build --prod/);
  assert.match(workflow, /vercel deploy --prebuilt --prod/);
  assert.match(workflow, /api\/x402-ping/);
  assert.match(workflow, /test "\$status" = "402"/);
  assert.match(workflow, /payment-required:/);
  assert.match(workflow, /No payment was sent/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE|X-PAYMENT/);
});

test("public health reports configured rail state without exposing credentials", () => {
  assert.match(health, /paymentRails:/);
  assert.match(health, /default: "payai"/);
  assert.match(health, /x402Ping: cdpFacilitatorEnabledForX402Ping \? "coinbase-cdp" : "payai"/);
  assert.match(health, /circleGatewayEnabled/);
  assert.doesNotMatch(health, /CDP_API_KEY_SECRET|CDP_API_KEY_ID/);
});
