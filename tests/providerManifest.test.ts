import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDomainProviderManifest,
  quoteProviderSuccessFee,
  PROVIDER_SUCCESS_FEE_BPS
} from "../src/lib/providerManifest";
import { BASE_USDC } from "../src/lib/x402SettlementVerify";

const manifestUrl =
  "https://provider.example/.well-known/agentresolver-provider.json";

function validManifest() {
  return {
    schemaVersion: 1,
    provider: {
      id: "searchco",
      name: "SearchCo"
    },
    commercial: {
      successFeeBps: 200,
      minimumSuccessFeeUsd: 0.001
    },
    routes: [{
      routeId: "searchco:web-search",
      capabilityId: "web-search",
      name: "Web Search",
      description: "Search public web data.",
      tags: ["search", "web"],
      endpoint: "https://provider.example/api/search",
      method: "GET",
      priceUsd: 1,
      payment: {
        network: "eip155:8453",
        asset: BASE_USDC,
        payTo: "0x2222222222222222222222222222222222222222",
        amountAtomic: "1000000"
      }
    }]
  };
}

test("domain provider manifest proves same-origin opt-in and payment identity", () => {
  const routes = parseDomainProviderManifest(manifestUrl, validManifest());
  assert.equal(routes.length, 1);
  assert.equal(routes[0]?.providerId, "searchco");
  assert.equal(routes[0]?.routeId, "searchco:web-search");
  assert.equal(routes[0]?.priceUsd, 1);
  assert.equal(routes[0]?.amountAtomic, "1000000");
  assert.equal(routes[0]?.successFeeBps, PROVIDER_SUCCESS_FEE_BPS);
});

test("domain provider manifest cannot enroll a third-party endpoint", () => {
  const manifest = validManifest();
  manifest.routes[0]!.endpoint = "https://victim.example/api/search";
  const routes = parseDomainProviderManifest(manifestUrl, manifest);
  assert.deepEqual(routes, []);
});

test("domain provider manifest must explicitly accept the platform fee contract", () => {
  const manifest = validManifest();
  manifest.commercial.successFeeBps = 1;
  assert.deepEqual(parseDomainProviderManifest(manifestUrl, manifest), []);
});

test("success-fee quote is 2 percent with a microtransaction floor", () => {
  const dollar = quoteProviderSuccessFee(
    "1000000",
    "atr_123e4567-e89b-42d3-a456-426614174000"
  );
  assert.equal(dollar.successFeeBps, 200);
  assert.ok(BigInt(dollar.baseFeeAmountAtomic) >= 20000n);
  assert.ok(BigInt(dollar.feeAmountAtomic) >= 20000n);

  const micro = quoteProviderSuccessFee(
    "1000",
    "atr_123e4567-e89b-42d3-a456-426614174000"
  );
  assert.equal(micro.baseFeeAmountAtomic, "1000");
});

test("attribution binding makes same-GMV fee proofs non-replayable across attributions", () => {
  const first = quoteProviderSuccessFee(
    "1000000",
    "atr_123e4567-e89b-42d3-a456-426614174000"
  );
  const second = quoteProviderSuccessFee(
    "1000000",
    "atr_223e4567-e89b-42d3-a456-426614174000"
  );

  assert.equal(first.baseFeeAmountAtomic, second.baseFeeAmountAtomic);
  assert.notEqual(first.feeAmountAtomic, second.feeAmountAtomic);
  assert.equal(first.attributionBound, true);
  assert.equal(second.attributionBound, true);
});
