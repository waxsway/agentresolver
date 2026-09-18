import assert from "node:assert/strict";
import test from "node:test";
import {
  getProviderRoute,
  providerNetworkSnapshot,
  registeredProviderRoutes,
  resolveProviderRoutes
} from "../src/lib/providerNetwork";

test("provider network exposes first-party registered handoffs and never arbitrary proxying", () => {
  const routes = registeredProviderRoutes({});
  assert.ok(routes.some((route) => route.routeId === "agentresolver:x402-ping"));
  assert.ok(routes.every((route) => route.execute.kind === "x402-handoff"));
  assert.equal(getProviderRoute("https://evil.example", {}), null);

  const snapshot = providerNetworkSnapshot("https://agentresolver.vercel.app", {});
  assert.equal(snapshot.mode, "registered_handoff_only");
  assert.equal(snapshot.arbitraryProxying, false);
  assert.equal(snapshot.callerSpendingAuthorized, false);
  assert.equal(snapshot.providerFunding.feeUsd, 0.001);
});

test("provider success-fee config is bounded and requires the fixed pilot fee", () => {
  const valid = JSON.stringify([{
    routeId: "searchco:web-search",
    providerId: "searchco",
    providerName: "SearchCo",
    capabilityId: "web-search",
    name: "Web Search",
    description: "Search public web results",
    tags: ["search", "web"],
    endpoint: "https://search.example/api",
    method: "POST",
    priceUsd: 0.01,
    network: "eip155:8453",
    commissionUsd: 0.001
  }]);
  const routes = registeredProviderRoutes({ AGENTRESOLVER_PROVIDER_REGISTRY_JSON: valid });
  const partner = routes.find((route) => route.routeId === "searchco:web-search");
  assert.ok(partner);
  assert.equal(partner?.funding.model, "provider-success-fee");
  assert.equal(partner?.funding.feeUsd, 0.001);

  const matches = resolveProviderRoutes("search the web", 5, {
    AGENTRESOLVER_PROVIDER_REGISTRY_JSON: valid
  });
  assert.ok(matches.some((route) => route.routeId === "searchco:web-search"));

  const invalid = valid.replace('"commissionUsd":0.001', '"commissionUsd":0.01');
  assert.equal(
    registeredProviderRoutes({ AGENTRESOLVER_PROVIDER_REGISTRY_JSON: invalid })
      .some((route) => route.routeId === "searchco:web-search"),
    false
  );
});
