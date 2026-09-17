import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_SKILLS_INDEX_URL,
  PAYMENT_GUARD_SKILL_URL,
  X402_BUYER_SETUP_URL,
  x402BuyerSetup,
  x402BuyerSetupHint
} from "../src/lib/x402BuyerSetup";

test("buyer setup is free, machine-readable and non-custodial", () => {
  const setup = x402BuyerSetup();
  assert.equal(setup.schemaVersion, 2);
  assert.equal(setup.free, true);
  assert.equal(setup.payment.protocol, "x402");
  assert.equal(setup.payment.version, 2);
  assert.equal(setup.payment.challengeHeader, "PAYMENT-REQUIRED");
  assert.equal(setup.payment.retryHeader, "PAYMENT-SIGNATURE");
  assert.equal(setup.payment.paymentIsAuthorizedByAgentResolver, false);
  assert.equal(setup.agentResolver.agentSkillsIndex, AGENT_SKILLS_INDEX_URL);
  assert.equal(setup.agentResolver.paymentGuardSkill, PAYMENT_GUARD_SKILL_URL);
  assert.equal(
    setup.agentResolver.canonicalPreflight,
    "https://agentresolver.vercel.app/api/x402-payment-preflight"
  );
  assert.equal(
    setup.agentResolver.paymentGuard,
    "https://agentresolver.vercel.app/api/payment-guard"
  );
  assert.equal(setup.agentResolver.paymentGuardRequest.method, "GET");
  assert.equal(setup.agentResolver.paymentGuardRequest.priceUsd, 0.001);
  assert.deepEqual(setup.agentResolver.paymentGuardRequest.requiredQuery, ["url"]);
  assert.ok(setup.agentResolver.paymentGuardRequest.optionalQuery.includes("expectedPayTo"));
  assert.equal(
    setup.agentResolver.paymentGuardRequest.repeatUse,
    "before_each_autonomous_x402_spend"
  );
  assert.ok(setup.recommendedSpendLoop.some((step) => /before each autonomous spend/i.test(step)));
  assert.equal(setup.authorizationBoundary.callerControlsSigner, true);
  assert.equal(setup.authorizationBoundary.callerControlsSpendPolicy, true);
  assert.equal(setup.authorizationBoundary.agentResolverReceivesPrivateKey, false);
  assert.equal(setup.authorizationBoundary.agentResolverReceivesSeedPhrase, false);
  assert.equal(setup.authorizationBoundary.agentResolverAuthorizesSpend, false);
  assert.equal(setup.clients.mcp.typescript.package, "@x402/mcp");
  assert.equal(setup.clients.mcp.typescript.factory, "createx402MCPClient");
  assert.equal(setup.clients.http.typescript.package, "@x402/fetch");
  assert.ok(setup.clients.http.typescript.packages.includes("@x402/fetch"));
  assert.ok(setup.clients.http.typescript.packages.includes("@x402/core"));
  assert.equal(setup.clients.http.typescript.client, "x402Client");
  assert.equal(setup.clients.http.typescript.wrapper, "wrapFetchWithPayment");
});

test("buyer setup hint points to the canonical free handoff", () => {
  const hint = x402BuyerSetupHint("x402-payment-preflight");
  assert.equal(hint.url, X402_BUYER_SETUP_URL);
  assert.equal(hint.agentSkillsIndex, AGENT_SKILLS_INDEX_URL);
  assert.equal(hint.paymentGuardSkill, PAYMENT_GUARD_SKILL_URL);
  assert.equal(hint.paymentAuthorizationRequired, true);
  assert.equal(hint.signerControlledByCaller, true);
});
