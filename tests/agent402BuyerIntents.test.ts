import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PAID_CAPABILITIES } from "../src/lib/paidCapabilities";

test("Agent402-facing canonical product names retain the four established buyer intents", () => {
  const preflight = PAID_CAPABILITIES["x402-payment-preflight"];
  assert.match(preflight.name, /verify endpoint before paying/i);
  assert.match(preflight.name, /endpoint safety/i);
  assert.match(preflight.name, /USDC payment check/i);

  const canary = PAID_CAPABILITIES["x402-ping"];
  assert.match(canary.name, /wallet facilitator payment test/i);
});

test("generated x402-ping GET owns the exact settlement-test buyer intent without changing stable operation id", () => {
  const openapi = JSON.parse(readFileSync("public/openapi.json", "utf8"));
  const postSummary = openapi.paths?.["/api/x402-ping"]?.post?.summary;
  const getOperation = openapi.paths?.["/api/x402-ping"]?.get;

  assert.match(postSummary, /wallet facilitator payment test/i);
  assert.equal(getOperation?.summary, "x402 Settlement Test");
  assert.equal(getOperation?.operationId, "x402SettlementPingGet");
});

test("USDC payment-check alias is a real advertised paid route with exact buyer-intent identity", () => {
  const openapi = JSON.parse(readFileSync("public/openapi.json", "utf8"));
  const operation = openapi.paths?.["/api/usdc-payment-check"]?.post;
  assert.equal(operation?.summary, "USDC Payment Check");
  assert.equal(operation?.operationId, "usdcPaymentCheck");

  const manifest = JSON.parse(readFileSync("public/.well-known/x402", "utf8"));
  const resource = manifest.resources?.find(
    (item: any) => item.resource === "POST /api/usdc-payment-check"
  );
  assert.equal(resource?.name, "USDC Payment Check");
  assert.equal(resource?.slug, "usdc-payment-check");
  assert.equal(resource?.endpoint, "https://agentresolver.vercel.app/api/usdc-payment-check");
});

test("alias route shares the canonical preflight executor and only overrides its public endpoint", () => {
  const canonical = readFileSync("src/app/api/x402-payment-preflight/route.ts", "utf8");
  const alias = readFileSync("src/app/api/usdc-payment-check/route.ts", "utf8");

  assert.match(canonical, /executeX402PaymentPreflight/);
  assert.match(alias, /executeX402PaymentPreflight/);
  assert.match(alias, /endpoint: "\/api\/usdc-payment-check"/);
});


test("Agent402 audit searches post-settlement receipt verification buyer intents", () => {
  const workflow = readFileSync(".github/workflows/register-agent402.yml", "utf8");
  assert.match(workflow, /"x402 settlement verify"/);
  assert.match(workflow, /"verify x402 transaction"/);
  assert.match(workflow, /"payment receipt verification"/);
});
