import assert from "node:assert/strict";
import test from "node:test";
import { parseProviderLaunchCheckInput } from "../src/lib/providerLaunchCheck";

test("provider launch input creates a bounded seller packet", () => {
  const parsed = parseProviderLaunchCheckInput({
    providerId: "searchco",
    providerName: "SearchCo",
    capabilityId: "web-search",
    name: "Web Search",
    description: "Search public web data.",
    origin: "https://search.example",
    endpoint: "https://search.example/api/search",
    method: "POST",
    probeUrl: "https://search.example/.well-known/x402-search",
    priceUsd: 0.01,
    network: "eip155:8453",
    tags: ["Search", "Web"]
  });
  assert.equal(parsed.providerId, "searchco");
  assert.equal(parsed.method, "POST");
  assert.equal(parsed.priceUsd, 0.01);
  assert.deepEqual(parsed.tags, ["search", "web"]);
});

test("POST-only providers must supply a safe GET probe URL", () => {
  assert.throws(() => parseProviderLaunchCheckInput({
    providerId: "searchco",
    providerName: "SearchCo",
    capabilityId: "web-search",
    name: "Web Search",
    description: "Search public web data.",
    origin: "https://search.example",
    endpoint: "https://search.example/api/search",
    method: "POST",
    priceUsd: 0.01,
    network: "eip155:8453"
  }));
});
