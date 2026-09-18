import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/activate-cdp-x402-ping.yml", "utf8");
const health = readFileSync("src/app/api/health/route.ts", "utf8");

test("CDP activation stays dormant until both Coinbase credentials exist in Vercel production", () => {
  assert.match(workflow, /\/v10\/projects\/\$VERCEL_PROJECT_ID\/env\?teamId=\$VERCEL_ORG_ID/);
  assert.match(workflow, /required = \{"CDP_API_KEY_ID", "CDP_API_KEY_SECRET"\}/);
  assert.match(workflow, /"production" in target/);
  assert.match(workflow, /CDP remains disabled/);
  assert.doesNotMatch(workflow, /secrets\.CDP_API_KEY_ID|secrets\.CDP_API_KEY_SECRET/);
  assert.doesNotMatch(workflow, /decrypt=true/);
});

test("CDP activation only mutates scoped non-secret flags and does not enable Circle", () => {
  assert.match(workflow, /"key": "AGENTRESOLVER_CDP_FACILITATOR_ENABLED"/);
  assert.match(workflow, /"value": "1"/);
  assert.match(workflow, /"key": "AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES"/);
  assert.match(workflow, /"value": "x402-ping"/);
  assert.match(workflow, /Circle Gateway is enabled in canonical production\. Refusing CDP activation/);
  assert.doesNotMatch(workflow, /"key": "AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED"/);
  assert.doesNotMatch(workflow, /"key": "CDP_API_KEY_ID"|"key": "CDP_API_KEY_SECRET"/);
});

test("CDP activation rechecks main and verifies a real unsigned production challenge", () => {
  assert.match(workflow, /git ls-remote origin refs\/heads\/main/);
  assert.match(workflow, /Refusing to deploy stale code/);
  assert.match(workflow, /vercel pull --yes --environment=production/);
  assert.match(workflow, /vercel build --prod/);
  assert.match(workflow, /vercel deploy --prebuilt --prod/);
  assert.match(workflow, /api\/x402-ping/);
  assert.match(workflow, /test "\$status" = "402"/);
  assert.match(workflow, /payment-required:/);
  assert.match(workflow, /No payment was sent/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE|X-PAYMENT/);
});

test("CDP activation remains automatically dormant after live activation", () => {
  assert.match(workflow, /cdpFacilitatorEnabledForX402Ping/);
  assert.match(workflow, /\.paymentRails\.x402Ping \/\/ ""/);
  assert.match(workflow, /active=true/);
  assert.match(workflow, /steps\.live_state\.outputs\.active != 'true'/);
});

test("public health reports configured rail state without exposing credentials", () => {
  assert.match(health, /paymentRails:/);
  assert.match(health, /default: "payai"/);
  assert.match(health, /x402Ping: cdpFacilitatorEnabledForX402Ping \? "coinbase-cdp" : "payai"/);
  assert.match(health, /circleGatewayEnabled/);
  assert.doesNotMatch(health, /CDP_API_KEY_SECRET|CDP_API_KEY_ID/);
});
