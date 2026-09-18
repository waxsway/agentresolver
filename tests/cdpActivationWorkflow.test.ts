import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/activate-cdp-x402-ping.yml", "utf8");
const health = readFileSync("src/app/api/health/route.ts", "utf8");
const payaiFailover = readFileSync(".github/workflows/restore-clean-after-nohumans.yml", "utf8");

test("CDP activation cannot run automatically", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /Type ENABLE_CDP_X402_PING to approve production activation/);
  assert.match(workflow, /CDP_ACTIVATION_CONFIRMATION/);
  assert.match(workflow, /ENABLE_CDP_X402_PING/);
  assert.doesNotMatch(workflow, /^\s*schedule:/m);
  assert.doesNotMatch(workflow, /^\s*push:/m);
});

test("CDP activation accepts canonical or existing production credential aliases without decrypting them", () => {
  assert.match(workflow, /\/v10\/projects\/\$VERCEL_PROJECT_ID\/env\?teamId=\$VERCEL_ORG_ID/);
  assert.match(workflow, /id_keys = \{"CDP_API_KEY_ID", "CDI_API_KEY_ID"\}/);
  assert.match(workflow, /secret_keys = \{"CDP_API_KEY_SECRET", "CDP_API_SECRET", "CDI_API_KEY_SECRET", "CDI_API_SECRET"\}/);
  assert.match(workflow, /has_id = bool\(id_keys & production_keys\)/);
  assert.match(workflow, /has_secret = bool\(secret_keys & production_keys\)/);
  assert.match(workflow, /"production" in target/);
  assert.match(workflow, /CDP remains disabled/);
  assert.doesNotMatch(workflow, /secrets\.CDP_API_KEY_ID|secrets\.CDP_API_KEY_SECRET/);
  assert.doesNotMatch(workflow, /decrypt=true/);
});

test("CDP activation only mutates scoped non-secret flags and never enables Circle", () => {
  assert.match(workflow, /"key": "AGENTRESOLVER_CDP_FACILITATOR_ENABLED"/);
  assert.match(workflow, /"value": "1"/);
  assert.match(workflow, /"key": "AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES"/);
  assert.match(workflow, /"value": "x402-ping"/);
  assert.match(workflow, /Circle Gateway is enabled in canonical production\. Refusing CDP activation/);
  assert.match(workflow, /\.paymentRails\.x402PingBase == "coinbase-cdp"/);
  assert.match(workflow, /\.paymentRails\.x402PingSolana == "payai"/);
  assert.doesNotMatch(workflow, /"key": "AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED"/);
  assert.doesNotMatch(workflow, /"key": "CDP_API_KEY_ID"|"key": "CDP_API_KEY_SECRET"/);
});

test("CDP activation rechecks main and verifies an unsigned production challenge without spending", () => {
  assert.match(workflow, /git ls-remote origin refs\/heads\/main/);
  assert.match(workflow, /Refusing to deploy stale code/);
  assert.match(workflow, /vercel pull --yes --environment=production/);
  assert.match(workflow, /vercel build --prod/);
  assert.match(workflow, /node \.github\/scripts\/vercel-deploy-prebuilt-runtime-env\.mjs \.vercel\/\.env\.production\.local/);
  assert.match(workflow, /api\/x402-ping/);
  assert.match(workflow, /test "\$status" = "402"/);
  assert.match(workflow, /payment-required:/);
  assert.match(workflow, /No payment was sent/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE|X-PAYMENT/);
});

test("public health reports route-local payment rails without exposing credentials", () => {
  assert.match(health, /paymentRails:/);
  assert.match(health, /default: "payai"/);
  assert.match(health, /x402Ping: "payai"/);
  assert.match(health, /x402PingBase: "payai"/);
  assert.match(health, /x402PingSolana: "payai"/);
  assert.match(health, /x402CdpCanary: cdpFacilitatorEnabledForCdpCanary \? "coinbase-cdp" : "disabled"/);
  assert.match(health, /cdpFacilitatorEnabledForX402Ping: false/);
  assert.match(health, /cdpFacilitatorEnabledForCdpCanary/);
  assert.match(health, /circleGatewayEnabled/);
  assert.doesNotMatch(health, /CDP_API_KEY_SECRET|CDP_API_KEY_ID/);
});


test("CDP runtime recovery re-aliases the known-good deployment without rebuilding or spending", () => {
  assert.match(payaiFailover, /HEALTHY_DEPLOYMENT_ID: dpl_ErXGyYownF8254n14tDvwwFMiPEv/);
  assert.match(payaiFailover, /HEALTHY_SHA: c2a05df127548c4ecc87ba73467cef72b6e721c3/);
  assert.match(payaiFailover, /CANONICAL_ALIAS: agentresolver\.vercel\.app/);
  assert.match(payaiFailover, /\/v2\/deployments\/\$HEALTHY_DEPLOYMENT_ID\/aliases\?teamId=\$VERCEL_ORG_ID/);
  assert.match(payaiFailover, /api\/x402-cdp-canary/);
  assert.match(payaiFailover, /api\/x402-ping/);
  assert.match(payaiFailover, /canary_sha.*HEALTHY_SHA/);
  assert.match(payaiFailover, /\.accepts\[0\]\.amount == "1000"/);
  assert.doesNotMatch(payaiFailover, /vercel build|vercel deploy/);
  assert.doesNotMatch(payaiFailover, /"key": "CDP_API_KEY_ID"|"key": "CDP_API_KEY_SECRET"/);
  assert.doesNotMatch(payaiFailover, /PAYMENT-SIGNATURE|X-PAYMENT/);
});
