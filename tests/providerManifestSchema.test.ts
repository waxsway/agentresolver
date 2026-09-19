import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseDomainProviderManifest } from "../src/lib/providerManifest";

const schema = JSON.parse(
  readFileSync("public/provider-manifest.schema.json", "utf8")
);
const example = JSON.parse(
  readFileSync("public/provider-manifest.example.json", "utf8")
);

test("provider manifest example points at the canonical published schema", () => {
  assert.equal(
    example.$schema,
    "https://agentresolver.vercel.app/provider-manifest.schema.json"
  );
  assert.equal(schema.$id, example.$schema);
  assert.equal(schema.properties?.schemaVersion?.const, 1);
  assert.equal(schema.properties?.commercial?.properties?.successFeeBps?.const, 200);
  assert.equal(
    schema.properties?.commercial?.properties?.minimumSuccessFeeUsd?.const,
    0.001
  );
});

test("provider schema locks the current Base USDC payment contract and route bounds", () => {
  const route = schema.properties?.routes?.items;
  assert.equal(schema.properties?.routes?.maxItems, 25);
  assert.deepEqual(route?.properties?.method?.enum, ["GET", "POST"]);
  assert.equal(
    route?.properties?.payment?.properties?.network?.const,
    "eip155:8453"
  );
  assert.equal(
    route?.properties?.payment?.properties?.asset?.const,
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  );
  assert.match(
    String(route?.properties?.endpoint?.pattern || ""),
    /https/
  );
});

test("published example remains accepted by the runtime manifest parser", () => {
  const routes = parseDomainProviderManifest(
    "https://provider.example/.well-known/agentresolver-provider.json",
    example
  );
  assert.equal(routes.length, 1);
  assert.equal(routes[0]?.providerId, "example-provider");
  assert.equal(routes[0]?.routeId, "example-provider:web-search");
  assert.equal(routes[0]?.amountAtomic, "10000");
});
