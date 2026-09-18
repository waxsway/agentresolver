import assert from "node:assert/strict";
import test from "node:test";
import { parseProviderLaunchCheckInput, providerLaunchReferenceInput } from "../src/lib/providerLaunchCheck";

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


test("reference paid GET input is a valid bounded provider launch packet", () => {
  const input = providerLaunchReferenceInput(new URLSearchParams());
  assert.equal(input.providerId, "agentresolver-reference");
  assert.equal(input.origin, "https://agentresolver.vercel.app/");
  assert.equal(input.endpoint, "https://agentresolver.vercel.app/api/x402-ping");
  assert.equal(input.method, "GET");
  assert.equal(input.priceUsd, 0.001);
  assert.equal(input.network, "eip155:8453");
});
