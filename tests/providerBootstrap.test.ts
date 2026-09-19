import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProviderBootstrap,
  normalizeProviderSeedOrigins
} from "../src/lib/providerBootstrap";
import {
  discoverSeededDomainProviderCandidates
} from "../src/lib/procureCapability";
import type { DomainProviderRoute } from "../src/lib/providerManifest";
import { BASE_USDC } from "../src/lib/x402SettlementVerify";

const route: DomainProviderRoute = {
  manifestUrl:
    "https://provider.example/.well-known/agentresolver-provider.json",
  origin: "https://provider.example",
  providerId: "searchco",
  providerName: "SearchCo",
  routeId: "searchco:web-search",
  capabilityId: "web-search",
  name: "Web Search",
  description: "Search the public web and return structured results.",
  tags: ["search", "web"],
  endpoint: "https://provider.example/api/search",
  method: "POST",
  priceUsd: 0.01,
  network: "eip155:8453",
  asset: BASE_USDC,
  payTo: "0x2222222222222222222222222222222222222222",
  amountAtomic: "10000",
  successFeeBps: 200,
  minimumSuccessFeeUsd: 0.001
};

test("provider bootstrap verifies manifest routes and returns caller-owned durable discovery action", async () => {
  const report = await buildProviderBootstrap(
    { origin: "https://provider.example" },
    {
      manifestFetcher: async (origin) => {
        assert.equal(origin, "https://provider.example");
        return [route];
      },
      routeVerifier: async (candidate) => candidate.routeId === route.routeId
    }
  );

  assert.equal(report.verifiedRoutes.length, 1);
  assert.equal(report.rejectedRoutes.length, 0);
  assert.equal(report.boundaries.AgentResolverPersistsProviderState, false);
  assert.equal(report.boundaries.AgentResolverSendsRegistryRegistration, false);

  const bootstrap = report.verifiedRoutes[0]!.durableDiscoveryBootstrap;
  assert.equal(bootstrap.registry, "402 Index");
  assert.equal(bootstrap.callerActionRequired, true);
  assert.equal(bootstrap.externalReviewMayApply, true);
  assert.equal(bootstrap.action.method, "POST");
  assert.equal(
    bootstrap.action.url,
    "https://402index.io/api/v1/register"
  );
  assert.equal(bootstrap.action.body.url, route.endpoint);
  assert.equal(bootstrap.action.body.http_method, "POST");
  assert.equal(bootstrap.action.body.probe_body, "{}");
  assert.equal(bootstrap.action.body.protocol, "x402");
  assert.equal(bootstrap.action.body.price_usd, 0.01);
  assert.equal(bootstrap.action.body.payment_asset, "USDC");
  assert.equal(bootstrap.action.body.payment_network, "Base");

  assert.deepEqual(
    report.immediateProcurement.rest.addToRequest.providerOrigins,
    ["https://provider.example"]
  );
});

test("provider bootstrap fails a route closed when the live x402 identity does not verify", async () => {
  const report = await buildProviderBootstrap(
    { origin: "https://provider.example" },
    {
      manifestFetcher: async () => [route],
      routeVerifier: async () => false
    }
  );

  assert.equal(report.verifiedRoutes.length, 0);
  assert.deepEqual(report.rejectedRoutes, [{
    routeId: route.routeId,
    reason: "live_x402_challenge_did_not_match_manifest"
  }]);
});

test("provider bootstrap rejects local, path-bearing, duplicate and over-broad origin seeds", () => {
  assert.throws(
    () => normalizeProviderSeedOrigins(["https://127.0.0.1"]),
    /Private or reserved/i
  );
  assert.throws(
    () => normalizeProviderSeedOrigins(["https://provider.internal"]),
    /Private or local/i
  );
  assert.throws(
    () => normalizeProviderSeedOrigins(["https://provider.example/api"]),
    /without a path or query/i
  );
  assert.throws(
    () => normalizeProviderSeedOrigins([
      "https://provider.example",
      "https://provider.example"
    ]),
    /unique/i
  );
  assert.throws(
    () => normalizeProviderSeedOrigins([
      "https://one.example",
      "https://two.example",
      "https://three.example"
    ]),
    /at most 2/i
  );
});

test("explicit provider origin can immediately seed a relevant verified procurement candidate", async () => {
  const candidates = await discoverSeededDomainProviderCandidates(
    "search the public web",
    ["https://provider.example"],
    {
      manifestFetcher: async () => [route],
      routeVerifier: async () => true
    }
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.source, "agentresolver-domain-seed");
  assert.equal(candidates[0]?.endpoint, route.endpoint);
  assert.equal(candidates[0]?.priceUsd, 0.01);
  assert.deepEqual(candidates[0]?.networks, ["eip155:8453"]);
  assert.deepEqual(
    (candidates[0]?.execute as any)?.paymentIdentity,
    {
      network: route.network,
      asset: route.asset,
      payTo: route.payTo,
      amountAtomic: route.amountAtomic
    }
  );
  assert.equal(
    (candidates[0]?.evidence as any)?.domainProviderEnrollment
      ?.liveX402ChallengeVerified,
    true
  );
});

test("seeded provider candidate is omitted when irrelevant or live verification fails", async () => {
  const irrelevant = await discoverSeededDomainProviderCandidates(
    "generate an image",
    ["https://provider.example"],
    {
      manifestFetcher: async () => [route],
      routeVerifier: async () => true
    }
  );
  assert.deepEqual(irrelevant, []);

  const failed = await discoverSeededDomainProviderCandidates(
    "search the web",
    ["https://provider.example"],
    {
      manifestFetcher: async () => [route],
      routeVerifier: async () => false
    }
  );
  assert.deepEqual(failed, []);
});
