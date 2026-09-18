import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const openapi = JSON.parse(readFileSync("public/openapi.json", "utf8"));

test("OpenAPI exposes current AgentCash discovery metadata", () => {
  assert.equal(openapi.openapi, "3.1.0");
  assert.match(openapi.info?.["x-guidance"] || "", /free capability discovery/i);
  assert.match(openapi.info?.["x-guidance"] || "", /GET \/api\/x402-ping/i);
  assert.match(openapi.info?.["x-guidance"] || "", /POST \/api\/x402-payment-preflight/i);
  assert.match(openapi.info?.title || "", /settlement canary/i);

  const canary = openapi.paths?.["/api/x402-ping"]?.get;
  assert.equal(canary?.operationId, "x402SettlementPingGet");
  assert.equal(canary?.requestBody, undefined);
  assert.equal(canary?.["x-payment-info"]?.priceUsd, 0.001);
  assert.match(canary?.description || "", /settlement test/i);
  assert.ok(canary?.tags?.includes("x402 settlement test"));
  assert.ok(canary?.["x-agentresolver-product"]?.keywords?.includes("payment canary"));
  const echoParam = canary?.parameters?.find((item: any) => item.name === "echo");
  assert.equal(echoParam?.in, "query");
  assert.equal(echoParam?.required, false);
  assert.equal(echoParam?.schema?.type, "string");
  assert.equal(echoParam?.schema?.maxLength, 256);
  assert.equal(canary?.["x-agentresolver-product"]?.inputTransport, "query");

  const guardGet = openapi.paths?.["/api/payment-guard"]?.get;
  assert.match(guardGet?.summary || "", /payment requirements before wallet signing/i);
  assert.match(guardGet?.description || "", /payTo recipient/i);
  assert.match(guardGet?.description || "", /maxPriceUsd/i);

  const preflight = openapi.paths?.["/api/x402-payment-preflight"]?.post;
  assert.match(preflight?.description || "", /endpoint safety/i);
  assert.match(preflight?.description || "", /USDC payment check/i);
  assert.ok(preflight?.tags?.includes("endpoint safety"));
  assert.ok(preflight?.tags?.includes("USDC payment check"));
  assert.ok(preflight?.["x-agentresolver-product"]?.keywords?.includes("verify endpoint before paying"));
  assert.deepEqual(openapi.paths?.["/api/resolve"]?.post?.security, []);
  assert.deepEqual(openapi.paths?.["/api/health"]?.get?.security, []);

  const paid = Object.values(openapi.paths || {})
    .map((item: any) => item?.post)
    .filter((op: any) => op?.tags?.includes("Paid Agent Capabilities"));

  assert.equal(paid.length, 10);
  assert.deepEqual(
    Object.keys(openapi.paths || {}).sort(),
    [
      "/api/api-trust-security-preflight",
      "/api/batch-verified-resolve",
      "/api/health",
      "/api/payment-guard",
      "/api/prepayment-authorization-gate",
      "/api/resolve",
      "/api/usdc-payment-check",
      "/api/verified-resolve",
      "/api/x402-payment-preflight",
      "/api/x402-ping",
      "/api/x402-preflight",
      "/api/x402-transaction-path-payment-gate"
    ].sort()
  );
  assert.equal(openapi.paths?.["/api/sha256"], undefined);
  assert.ok(openapi.paths?.["/api/usdc-payment-check"]?.post);
  for (const op of paid as any[]) {
    const info = op["x-payment-info"];
    assert.equal(info?.price?.mode, "fixed");
    assert.equal(info?.price?.currency, "USD");
    assert.match(String(info?.price?.amount || ""), /^\d+(?:\.\d+)?$/);
    assert.deepEqual(info?.protocols, [{ x402: {} }]);
    assert.equal(info?.protocol, "x402");
    assert.equal(typeof info?.priceUsd, "number");
  }
});


test("public discovery stays focused on the settlement-to-Guard revenue funnel", () => {
  const manifest = JSON.parse(readFileSync("public/.well-known/x402", "utf8"));
  const capabilities = JSON.parse(readFileSync("public/capabilities.json", "utf8"));
  const integrations = JSON.parse(readFileSync("public/integrations.json", "utf8"));

  const paidIds = new Set([
    "x402-ping",
    "x402-payment-preflight",
    "verified-resolve",
    "batch-verified-resolve"
  ]);

  assert.deepEqual(
    (manifest.services || []).map((item: any) => item.id).sort(),
    [...paidIds].sort()
  );
  assert.ok(
    (manifest.resources || []).every((item: any) =>
      ["/api/x402-ping", "/api/x402-payment-preflight", "/api/verified-resolve", "/api/batch-verified-resolve"]
        .some((path) => String(item.resource || "").endsWith(path))
    )
  );

  const publicPaidCapabilityIds = (capabilities.capabilities || [])
    .filter((item: any) => Number(item.priceUsd) > 0)
    .map((item: any) => item.id);
  assert.deepEqual(publicPaidCapabilityIds.sort(), [...paidIds].sort());

  const integrationIds = (integrations.paidActions || []).map((item: any) => item.id);
  assert.deepEqual(integrationIds.sort(), [...paidIds].sort());

  assert.match(manifest.instructions || "", /intentionally omitted from public machine catalogs/i);
  assert.match(openapi.info?.description || "", /reduce unpaid crawler sweeps/i);
});
