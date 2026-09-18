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


test("AgentResolver Guard is additive to the canonical preflight contract", () => {
  const manifest = readJson("public/.well-known/x402");
  const preflightService = manifest.services?.find((item: any) => item.id === "x402-payment-preflight");
  assert.equal(preflightService?.brandName, "AgentResolver Guard");
  assert.ok(preflightService?.aliases?.includes("https://agentresolver.vercel.app/api/payment-guard"));
  assert.equal(preflightService?.repeatUse, "before_every_autonomous_x402_spend");

  const openapi = readJson("public/openapi.json");
  const canonical = openapi.paths?.["/api/x402-payment-preflight"];
  const guard = openapi.paths?.["/api/payment-guard"];
  assert.ok(canonical?.get);
  assert.ok(canonical?.post);
  assert.ok(guard?.get);
  assert.ok(guard?.post);
  assert.equal(guard?.["x-agentresolver-alias-of"], "/api/x402-payment-preflight");
  assert.equal(guard.get.operationId, "agentResolverPaymentGuardGet");
  assert.equal(guard.post.operationId, "agentResolverPaymentGuardPost");
  assert.equal(canonical.post.operationId, "x402PaymentPreflightPayToVerification");
});


test("GET-first discovery copy preserves caller-only spend authorization", () => {
  const openapi = readJson("public/openapi.json");
  assert.match(openapi.info?.description ?? "", /payment verification for autonomous buyers/i);
  assert.doesNotMatch(openapi.info?.description ?? "", /payment authorization for autonomous buyers/i);
  assert.match(openapi.info?.["x-guidance"] ?? "", /GET \/api\/x402-payment-preflight/);

  const manifest = readJson("public/.well-known/x402");
  const preflightGetResource = manifest.resources?.find(
    (item: any) => item.resource === "GET /api/x402-payment-preflight"
  );
  assert.match(preflightGetResource?.name ?? "", /payment verification/i);
  assert.doesNotMatch(preflightGetResource?.name ?? "", /payment authorization/i);
  assert.match(preflightGetResource?.description ?? "", /caller alone authorizes any spend/i);
  assert.doesNotMatch(preflightGetResource?.description ?? "", /authorization gate/i);
});


test("x402 settlement canary is a first-class Bazaar discovery resource", () => {
  const manifest = readJson("public/.well-known/x402");
  const ping = manifest.resources?.find((item: any) => item.resource === "GET /api/x402-ping");
  assert.ok(ping, "GET x402-ping must be published as a discovery resource");
  assert.equal(ping.method, "GET");
  assert.equal(ping.price, "$0.001");
  assert.equal(ping.accepts?.[0]?.network, "eip155:8453");
  assert.equal(ping.accepts?.[0]?.maxAmountRequired, "1000");
  assert.equal(ping.accepts?.[0]?.payTo, "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8");
});


test("Base USDC settlement verification is GET-first in focused machine discovery", () => {
  const manifest = readJson("public/.well-known/x402");
  const service = manifest.services?.find((item: any) => item.id === "base-usdc-settlement-verify");
  assert.equal(service?.method, "GET");
  assert.equal(service?.preferredMethod, "GET");

  const resource = manifest.resources?.find(
    (item: any) => item.resource === "GET /api/base-usdc-settlement-verify"
  );
  assert.ok(resource, "GET Base USDC settlement verifier must be published");
  assert.equal(resource.price, "$0.001");
  assert.equal(resource.inputTransport, "query");
  assert.ok(resource.queryParameters?.some((item: any) =>
    item.name === "transactionHash" && item.required === true
  ));

  const openapi = readJson("public/openapi.json");
  const pathItem = openapi.paths?.["/api/base-usdc-settlement-verify"];
  assert.ok(pathItem?.get);
  assert.ok(pathItem?.post);
  assert.equal(pathItem["x-agentresolver-preferred-method"], "GET");
  assert.equal(pathItem.get.requestBody, undefined);
  assert.equal(pathItem.get["x-agentresolver-product"]?.inputTransport, "query");
});
