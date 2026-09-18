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

test("settled canary next actions expose canonical preflight without removing resolver handoffs", () => {
  const next = postSettlementCanaryNextActions();
  const preflight = getPaidCapability("x402-payment-preflight");
  const hashEncode = getPaidCapability("hash-encode");
  const single = getPaidCapability("verified-resolve");
  const batch = getPaidCapability("batch-verified-resolve");

  assert.equal(next.catalogUrl, `${CANONICAL_ORIGIN}/.well-known/x402`);
  assert.deepEqual(next.recommended, {
    capabilityId: hashEncode.id,
    endpoint: `${CANONICAL_ORIGIN}${hashEncode.endpoint}?operation=sha256&input=agentresolver`,
    method: "GET",
    priceUsd: hashEncode.priceUsd,
    useWhen: hashEncode.useWhen,
    inputExample: hashEncode.example,
    reason: "Your x402 client just proved it can settle and receive paid delivery. Reuse the same x402 payment flow on a useful deterministic $0.001 GET with no account or API key.",
    repeatUse: "when_a_deterministic_hash_or_encoding_transform_is_needed",
    paymentAuthorization: "separate_caller_authorization_required"
  });
  assert.deepEqual(next.preflight, {
    capabilityId: preflight.id,
    endpoint: `${CANONICAL_ORIGIN}${preflight.endpoint}`,
    method: "GET",
    priceUsd: preflight.priceUsd,
    useWhen: preflight.useWhen,
    inputExample: preflight.example
  });
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
  assert.equal(next.recommended.capabilityId, "hash-encode");
  assert.equal(next.recommended.priceUsd, 0.001);
  assert.equal(next.recommended.repeatUse, "when_a_deterministic_hash_or_encoding_transform_is_needed");
  assert.equal(next.recommended.paymentAuthorization, "separate_caller_authorization_required");
  assert.equal(next.preflight.priceUsd, 0.001);
  assert.equal(next.single.priceUsd, 0.02);
  assert.equal(next.batch.priceUsd, 0.05);
  assert.equal(isDirectOwnedCapabilityId(next.preflight.capabilityId), true);
  assert.equal(isDirectOwnedCapabilityId(next.single.capabilityId), true);
  assert.equal(isDirectOwnedCapabilityId(next.batch.capabilityId), true);
});
