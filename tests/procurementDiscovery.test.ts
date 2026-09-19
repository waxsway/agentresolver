import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

test("procurement is exposed as the primary free machine integration surface", () => {
  const capabilities = readJson("public/capabilities.json");
  const integrations = readJson("public/integrations.json");
  const openapi = readJson("public/openapi.json");

  const procure = capabilities.capabilities.find(
    (item: any) => item.id === "capability-procurement"
  );

  assert.ok(procure, "missing capability-procurement from capabilities.json");
  assert.equal(procure.priceUsd, 0);
  assert.equal(procure.endpoint, "/api/procure");

  assert.equal(integrations.mcp?.primaryTool, "procure");
  assert.equal(integrations.mcp?.secondaryTool, "resolve");
  assert.equal(integrations.mcp?.spendingAuthorized, false);
  assert.equal(
    integrations.restFallback?.url,
    "https://agentresolver.vercel.app/api/procure"
  );

  const operation = openapi.paths?.["/api/procure"]?.post;
  assert.ok(operation, "missing /api/procure from OpenAPI");
  assert.deepEqual(operation.security, []);
  assert.equal(operation.operationId, "procureCapability");
  assert.match(operation.description, /non-custodial/i);
});

test("generated x402 manifest points agents at procurement without claiming spending authority", () => {
  const manifest = readJson("public/.well-known/x402");
  assert.equal(
    manifest.freeDiscovery?.procure,
    "https://agentresolver.vercel.app/api/procure"
  );
  assert.equal(
    manifest.freeDiscovery?.resolve,
    "https://agentresolver.vercel.app/api/resolve"
  );
  assert.match(manifest.instructions, /procure/i);
});
