import test from "node:test";
import assert from "node:assert/strict";
import {
  DIRECT_OWNED_CAPABILITY_IDS,
  directOwnedRecommendationInput,
  isDirectOwnedCapabilityId,
  postSettlementCanaryNextActions
} from "../src/lib/paidRecommendationPolicy";
import { CANONICAL_ORIGIN, getPaidCapability } from "../src/lib/paidCapabilities";

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

test("settled canary next actions stay synchronized with authoritative paid capability metadata", () => {
  const next = postSettlementCanaryNextActions();
  const single = getPaidCapability("verified-resolve");
  const batch = getPaidCapability("batch-verified-resolve");

  assert.equal(next.catalogUrl, `${CANONICAL_ORIGIN}/.well-known/x402`);
  assert.deepEqual(next.single, {
    capabilityId: single.id,
    endpoint: `${CANONICAL_ORIGIN}${single.endpoint}`,
    method: "POST",
    priceUsd: single.priceUsd,
    useWhen: single.useWhen,
    inputExample: single.example
  });
  assert.deepEqual(next.batch, {
    capabilityId: batch.id,
    endpoint: `${CANONICAL_ORIGIN}${batch.endpoint}`,
    method: "POST",
    priceUsd: batch.priceUsd,
    useWhen: batch.useWhen,
    inputExample: batch.example
  });
  assert.equal(next.single.priceUsd, 0.02);
  assert.equal(next.batch.priceUsd, 0.05);
  assert.equal(isDirectOwnedCapabilityId(next.single.capabilityId), true);
  assert.equal(isDirectOwnedCapabilityId(next.batch.capabilityId), true);
});
