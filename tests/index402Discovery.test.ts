import assert from "node:assert/strict";
import test from "node:test";
import {
  discover402IndexServices,
  normalize402IndexService
} from "../src/lib/index402Discovery";

test("402 Index normalizer represents x402, L402, and MPP without collapsing rails", () => {
  const x402 = normalize402IndexService({
    id: 1,
    name: "Base Search",
    url: "https://example.com/search",
    protocol: "x402",
    price_usd: 0.01,
    payment_asset: "USDC",
    payment_network: "Base",
    provider: "Example",
    health_status: "healthy",
    x402_payment_valid: 1,
    domain_verified: 1,
    reliability_score: 97
  });
  assert.equal(x402?.protocol, "x402");
  assert.deepEqual(x402?.networks, ["eip155:8453"]);
  assert.equal(x402?.paymentVerified, true);
  assert.equal(x402?.domainVerified, true);

  const l402 = normalize402IndexService({
    id: 2,
    name: "Lightning Data",
    url: "https://example.net/data",
    protocol: "L402",
    price_usd: 0.002,
    payment_asset: "BTC",
    payment_network: "Lightning",
    health_status: "healthy",
    l402_format: "v2_tlv",
    lnget_compatible: 1
  });
  assert.equal(l402?.protocol, "l402");
  assert.deepEqual(l402?.networks, ["lightning"]);
  assert.equal(l402?.paymentVerified, true);
  assert.equal(l402?.lngetCompatible, true);

  const mpp = normalize402IndexService({
    id: 3,
    name: "MPP Tool",
    url: "https://mpp.example/tool",
    protocol: "MPP",
    price_usd: 0.03,
    payment_network: "custom",
    health_status: "healthy"
  });
  assert.equal(mpp?.protocol, "mpp");
});

test("402 Index discovery requests only verified bounded results and forwards budget/protocol", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      services: [
        {
          id: 7,
          name: "Verified Search",
          description: "Search public data",
          url: "https://verified.example/search",
          protocol: "x402",
          price_usd: 0.005,
          payment_asset: "USDC",
          payment_network: "Base",
          health_status: "healthy",
          x402_payment_valid: 1,
          domain_verified: 1,
          reliability_score: 99,
          http_method: "GET"
        }
      ]
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const results = await discover402IndexServices(
      "search public market data",
      3,
      { maxPriceUsd: 0.01, protocol: "x402" }
    );

    assert.equal(results.length, 1);
    assert.equal(results[0]?.resource, "https://verified.example/search");
    const requested = new URL(requestedUrl);
    assert.equal(requested.searchParams.get("verified"), "true");
    assert.equal(requested.searchParams.get("max_price_usd"), "0.01");
    assert.equal(requested.searchParams.get("protocol"), "x402");
    assert.equal(requested.searchParams.get("limit"), "10");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("402 Index normalizer rejects non-HTTPS and unsupported payment protocols", () => {
  assert.equal(normalize402IndexService({
    id: 1,
    name: "Bad",
    url: "http://example.com",
    protocol: "x402"
  }), null);

  assert.equal(normalize402IndexService({
    id: 2,
    name: "Bad",
    url: "https://example.com",
    protocol: "stripe"
  }), null);
});
