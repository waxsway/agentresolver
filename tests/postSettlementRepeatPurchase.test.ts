import test from "node:test";
import assert from "node:assert/strict";
import { postSettlementCanaryNextActions } from "../src/lib/paidRecommendationPolicy";

test("paid settlement recommends a useful repeat x402 GET", () => {
  const next = postSettlementCanaryNextActions();
  assert.equal(next.recommended.capabilityId, "hash-encode");
  assert.equal(next.recommended.method, "GET");
  assert.equal(next.recommended.priceUsd, 0.001);
  assert.equal(
    next.recommended.endpoint,
    "https://agentresolver.vercel.app/api/hash-encode?operation=sha256&input=agentresolver"
  );
  assert.deepEqual(next.recommended.inputExample, {
    operation: "sha256",
    input: "agentresolver"
  });
  assert.equal(
    next.recommended.paymentAuthorization,
    "separate_caller_authorization_required"
  );
  assert.equal(next.preflight.capabilityId, "x402-payment-preflight");
  assert.equal(next.settlementVerify.capabilityId, "x402-settlement-verify");
  assert.equal(next.settlementVerify.method, "GET");
  assert.equal(next.settlementVerify.priceUsd, 0.001);
  assert.match(next.settlementVerify.transactionHashSource, /PAYMENT-RESPONSE/);
  assert.equal(
    next.settlementVerify.paymentAuthorization,
    "separate_caller_authorization_required"
  );
});
