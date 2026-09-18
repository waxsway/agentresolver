import test from "node:test";
import assert from "node:assert/strict";
import { postSettlementCanaryNextActions } from "../src/lib/paidRecommendationPolicy";

test("paid settlement recommends a useful repeat x402 GET", () => {
  const next = postSettlementCanaryNextActions();
  assert.equal(next.recommended.capabilityId, "x402-payment-preflight");
  assert.equal(next.recommended.method, "GET");
  assert.equal(next.recommended.priceUsd, 0.001);
  assert.equal(
    next.recommended.endpoint,
    "https://agentresolver.vercel.app/api/x402-payment-preflight"
  );
  assert.deepEqual(next.recommended.inputExample, {
    url: "https://example.com/api",
    method: "GET",
    maxPriceUsd: 0.01
  });
  assert.equal(next.recommended.repeatUse, "before_each_autonomous_x402_payment");
  assert.match(next.recommended.reason, /next autonomous x402 spend/i);
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
