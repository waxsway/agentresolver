import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

test("machine catalogs advertise GET-first x402 preflight while preserving POST", () => {
  const manifest = readJson("public/.well-known/x402");
  const preflightService = manifest.services?.find((item: any) => item.id === "x402-payment-preflight");
  assert.equal(preflightService?.method, "GET");
  assert.deepEqual(preflightService?.methods, ["GET", "POST"]);
  assert.equal(preflightService?.preferredMethod, "GET");

  const preflightGetResource = manifest.resources?.find(
    (item: any) => item.resource === "GET /api/x402-payment-preflight"
  );
  const preflightPostResource = manifest.resources?.find(
    (item: any) => item.resource === "POST /api/x402-payment-preflight"
  );
  assert.ok(preflightGetResource, "GET preflight resource must be published");
  assert.ok(preflightPostResource, "POST preflight resource must remain published");
  assert.equal(preflightGetResource.method, "GET");
  assert.equal(preflightGetResource.inputTransport, "query");
  assert.match(manifest.instructions, /GET \/api\/x402-payment-preflight/);

  const capabilities = readJson("public/capabilities.json");
  const capability = capabilities.capabilities?.find((item: any) => item.id === "x402-payment-preflight");
  assert.equal(capability?.method, "GET");
  assert.deepEqual(capability?.methods, ["GET", "POST"]);
  assert.equal(capability?.preferredMethod, "GET");

  const integrations = readJson("public/integrations.json");
  const integration = integrations.paidActions?.find((item: any) => item.id === "x402-payment-preflight");
  assert.equal(integration?.method, "GET");
  assert.deepEqual(integration?.methods, ["GET", "POST"]);
  assert.equal(integration?.preferredMethod, "GET");
  assert.equal(integration?.queryExample?.url, "https://example.com/api");

  const openapi = readJson("public/openapi.json");
  const pathItem = openapi.paths?.["/api/x402-payment-preflight"];
  assert.ok(pathItem?.get, "OpenAPI GET preflight operation must exist");
  assert.ok(pathItem?.post, "OpenAPI POST preflight operation must remain available");
  assert.equal(pathItem["x-agentresolver-preferred-method"], "GET");
  assert.equal(pathItem.get.requestBody, undefined);
  assert.equal(pathItem.get["x-agentresolver-product"]?.inputTransport, "query");
  assert.equal(pathItem.post["x-agentresolver-product"]?.inputTransport, "json-body");

  const urlParam = pathItem.get.parameters?.find((item: any) => item.name === "url");
  assert.equal(urlParam?.in, "query");
  assert.equal(urlParam?.required, true);
  assert.match(openapi.info?.["x-guidance"] ?? "", /GET \/api\/x402-payment-preflight/);
});

test("x402 settlement canary remains GET-first across catalogs", () => {
  const manifest = readJson("public/.well-known/x402");
  const pingService = manifest.services?.find((item: any) => item.id === "x402-ping");
  assert.equal(pingService?.method, "GET");
  assert.equal(pingService?.preferredMethod, "GET");

  const openapi = readJson("public/openapi.json");
  const pingPath = openapi.paths?.["/api/x402-ping"];
  assert.ok(pingPath?.get);
  assert.ok(pingPath?.post);
  assert.equal(pingPath["x-agentresolver-preferred-method"], "GET");
});
