import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGENTRESOLVER_TRUST_CONTRACT } from "../src/lib/trustContract";
import { GET as getSecurityTxt } from "../src/app/.well-known/security.txt/route";

test("trust contract declares the canonical non-custodial payment boundary", () => {
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.schemaVersion, 1);
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.paymentModel.custodial, false);
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.paymentModel.holdsCustomerBalances, false);
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.paymentModel.forwardsThirdPartyPrincipalPayments, false);
  assert.equal(
    AGENTRESOLVER_TRUST_CONTRACT.canonicalPaidRoute.url,
    "https://agentresolver.vercel.app/api/x402-payment-preflight"
  );
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.supportedSettlement.length, 2);
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.probeSafety.httpsOnly, true);
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.probeSafety.privateAndReservedIpRangesBlocked, true);
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.probeSafety.redirectsFollowed, false);
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.probeSafety.postProbeRequiresExplicitOptIn, true);
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.probeSafety.responseBodyConsumed, false);
});

test("public manifests point buyers at the canonical preflight", () => {
  const service = JSON.parse(readFileSync("public/.well-known/x402-service.json", "utf8"));
  const agent = JSON.parse(readFileSync("public/.well-known/agent.json", "utf8"));

  assert.equal(service.endpoint, "https://agentresolver.vercel.app/api/x402-payment-preflight");
  assert.equal(service.x402Version, 2);
  assert.equal(service.trust, "https://agentresolver.vercel.app/.well-known/agentresolver-trust.json");

  assert.equal(agent.non_custodial, true);
  assert.equal(agent.intents[0].endpoint, "/api/x402-payment-preflight");
  assert.equal(agent.trust_url, "https://agentresolver.vercel.app/.well-known/agentresolver-trust.json");
});

test("security.txt has the RFC 9116 required disclosure fields", async () => {
  const response = getSecurityTxt();
  const body = await response.text();

  assert.match(response.headers.get("content-type") || "", /^text\/plain/);
  assert.match(body, /^Contact: https:\/\/github\.com\/waxsway\/agentresolver\/security\/advisories\/new/m);
  assert.match(body, /^Expires: 2027-03-16T00:00:00Z$/m);
  assert.match(body, /^Canonical: https:\/\/agentresolver\.vercel\.app\/\.well-known\/security\.txt$/m);
});

test("production config traces the canonical paid route and sends HSTS", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /"\/api\/x402-payment-preflight": x402Tracing/);
  assert.match(config, /Strict-Transport-Security/);
  assert.match(config, /agentresolver-trust\.json/);
});
