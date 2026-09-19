import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const openapi = JSON.parse(readFileSync("public/openapi.json", "utf8"));
const capabilities = JSON.parse(
  readFileSync("public/capabilities.json", "utf8")
);
const integration = JSON.parse(
  readFileSync("public/provider-integration.json", "utf8")
);
const bootstrapSource = readFileSync(
  "src/lib/providerBootstrap.ts",
  "utf8"
);
const leanMcp = readFileSync("src/app/mcp/control/route.ts", "utf8");
const fullMcp = readFileSync("src/app/mcp/route.ts", "utf8");

test("provider bootstrap is a free zero-state machine contract", () => {
  assert.deepEqual(openapi.paths["/api/provider-bootstrap"].post.security, []);
  assert.equal(
    openapi.paths["/api/provider-bootstrap"].post.requestBody.content[
      "application/json"
    ].schema.properties.routeIds.maxItems,
    5
  );
  assert.equal(
    capabilities.capabilities.some(
      (item: any) => item.id === "provider-bootstrap" && item.priceUsd === 0
    ),
    true
  );
  assert.equal(
    integration.providerEnrollment.bootstrap.persistence,
    "none"
  );
});

test("procurement and Verified Resolve preserve the same bounded provider origin seed", () => {
  const procure =
    openapi.paths["/api/procure"].post.requestBody.content[
      "application/json"
    ].schema.properties.providerOrigins;
  const verified =
    openapi.paths["/api/verified-resolve"].post.requestBody.content[
      "application/json"
    ].schema.properties.providerOrigins;

  assert.equal(procure.maxItems, 2);
  assert.equal(procure.uniqueItems, true);
  assert.equal(verified.maxItems, 2);
  assert.equal(verified.uniqueItems, true);
});

test("AgentResolver never acts as the provider's external registry relay", () => {
  assert.match(bootstrapSource, /registrationSentByAgentResolver: false/);
  assert.match(bootstrapSource, /callerActionRequired: true/);
  assert.match(
    bootstrapSource,
    /https:\/\/402index\.io\/api\/v1\/register/
  );
  assert.doesNotMatch(
    bootstrapSource,
    /fetch\(\s*["'`]https:\/\/402index\.io\/api\/v1\/register/
  );
  assert.equal(
    integration.providerEnrollment.bootstrap.durableDiscovery
      .registrationSentByAgentResolver,
    false
  );
});

test("provider bootstrap stays off the lean buyer MCP but is available on the full provider surface", () => {
  assert.doesNotMatch(leanMcp, /registerTool\(\s*"provider_bootstrap"/);
  assert.match(fullMcp, /registerTool\(\s*"provider_bootstrap"/);
  assert.match(leanMcp, /providerOrigins/);
  assert.match(fullMcp, /providerOrigins/);
});
