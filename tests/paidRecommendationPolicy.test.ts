import test from "node:test";
import assert from "node:assert/strict";
import {
  DIRECT_OWNED_CAPABILITY_IDS,
  directOwnedRecommendationInput,
  isDirectOwnedCapabilityId
} from "../src/lib/paidRecommendationPolicy";

test("canonical x402 preflight is a directly recommendable owned capability", () => {
  assert.equal(DIRECT_OWNED_CAPABILITY_IDS.has("x402-payment-preflight"), true);
  assert.equal(isDirectOwnedCapabilityId("x402-payment-preflight"), true);
});

test("canonical x402 preflight recommendation carries the target URL directly", () => {
  assert.deepEqual(
    directOwnedRecommendationInput(
      "x402-payment-preflight",
      "verify this x402 endpoint before paying",
      "https://merchant.example/api/paid"
    ),
    {
      url: "https://merchant.example/api/paid",
      method: "GET"
    }
  );
});
