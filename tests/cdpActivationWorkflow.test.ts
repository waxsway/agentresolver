import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  ".github/workflows/activate-cdp-canary.yml",
  "utf8"
);
const health = readFileSync("src/app/api/health/route.ts", "utf8");

test("CDP activation is gated only by the Coinbase credential pair", () => {
  assert.match(workflow, /secrets\.CDP_API_KEY_ID/);
  assert.match(workflow, /secrets\.CDP_API_KEY_SECRET/);
  assert.match(workflow, /credential pair is incomplete/);
  assert.match(workflow, /credentials are not configured; activation remains dormant/);
  assert.doesNotMatch(workflow, /PRIVATE_KEY|SEED|MNEMONIC|PAYMENT-SIGNATURE|X-PAYMENT/i);
});

test("CDP activation remains bounded to x402-ping and leaves Guard on PayAI", () => {
  assert.match(workflow, /AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES/);
  assert.match(workflow, /printf '%s' "x402-ping"/);
  assert.match(workflow, /configuredPaymentRails\.x402Ping == "coinbase-cdp"/);
  assert.match(workflow, /configuredPaymentRails\.x402PaymentPreflight == "payai"/);
  assert.match(workflow, /configuredPaymentRails\.circleGatewayEnabled == false/);
});

test("CDP credentials are stored as Vercel sensitive production variables", () => {
  assert.match(workflow, /vercel env add CDP_API_KEY_ID production --force --sensitive/);
  assert.match(workflow, /vercel env add CDP_API_KEY_SECRET production --force --sensitive/);
  assert.doesNotMatch(workflow, /echo "\$CDP_API_KEY_(?:ID|SECRET)"/);
  assert.match(workflow, /umask 077/);
});

test("CDP activation refuses Circle and stale main without spending", () => {
  assert.match(workflow, /AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED === "1"/);
  assert.match(workflow, /Main advanced during the CDP build/);
  assert.match(workflow, /AGENTRESOLVER_CDP_FACILITATOR_ENABLED production/);
  assert.match(workflow, /x-agentresolver-internal: 1/);
  assert.doesNotMatch(workflow, /payment retry|signed payment|wallet private/i);
});

test("health exposes bounded rail configuration without credential state", () => {
  assert.match(health, /configuredPaymentRails/);
  assert.match(health, /x402Ping: configuredPaymentRail\("x402-ping"\)/);
  assert.match(health, /x402PaymentPreflight: configuredPaymentRail\("x402-payment-preflight"\)/);
  assert.match(health, /circleGatewayEnabled:/);
  assert.doesNotMatch(health, /CDP_API_KEY_ID|CDP_API_KEY_SECRET/);
});

test("CDP activation can be retried automatically after credentials are added", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /cron: "17 \* \* \* \*"/);
  assert.match(workflow, /already has the bounded Coinbase CDP canary rail active/);
});
