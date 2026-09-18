import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CANONICAL_ORIGIN, PAID_CAPABILITY_LIST } from "../src/lib/paidCapabilities";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

test("paid capability registry identifiers and prices are coherent", () => {
  assert.equal(new Set(PAID_CAPABILITY_LIST.map((item) => item.id)).size, PAID_CAPABILITY_LIST.length);
  assert.equal(new Set(PAID_CAPABILITY_LIST.map((item) => item.endpoint)).size, PAID_CAPABILITY_LIST.length);
  assert.equal(new Set(PAID_CAPABILITY_LIST.map((item) => item.quoteTool.name)).size, PAID_CAPABILITY_LIST.length);

  for (const product of PAID_CAPABILITY_LIST) {
    assert.equal(Number(product.price.slice(1)), product.priceUsd);
    assert.equal(product.atomicAmount, String(Math.round(product.priceUsd * 1_000_000)));
    assert.match(product.endpoint, /^\/api\//);
  }
});

test("public machine surfaces focus on the revenue funnel while the runtime registry stays complete", () => {
  const x402 = readJson("public/.well-known/x402");
  const capabilities = readJson("public/capabilities.json");
  const integrations = readJson("public/integrations.json");
  const openapi = readJson("public/openapi.json");

  const publicIds = new Set([
    "x402-ping",
    "x402-payment-preflight",
    "verified-resolve",
    "batch-verified-resolve"
  ]);

  assert.equal(
    x402.verifiedSettlementHistory,
    "https://agentresolver.vercel.app/.well-known/agentresolver-reputation.json"
  );
  assert.match(x402.description, /payment verification/i);

  for (const product of PAID_CAPABILITY_LIST) {
    assert.match(product.endpoint, /^\/api\//);
    if (!publicIds.has(product.id)) {
      assert.equal(
        openapi.paths?.[product.endpoint],
        undefined,
        `${product.id} should remain live but omitted from public OpenAPI discovery`
      );
      continue;
    }

    const x402Resource = x402.resources.find((item: any) => item.resource === `POST ${product.endpoint}`);
    assert.ok(x402Resource, `missing focused x402 resource for ${product.id}`);
    assert.equal(x402Resource.price, product.price);
    assert.equal(x402Resource.accepts?.[0]?.amount, product.atomicAmount);
    assert.equal(x402Resource.accepts?.[0]?.resource, `${CANONICAL_ORIGIN}${product.endpoint}`);

    const capability = capabilities.capabilities.find((item: any) => item.id === product.id);
    assert.ok(capability, `missing focused capabilities.json entry for ${product.id}`);

    const integration = integrations.paidActions.find((item: any) => item.id === product.id);
    assert.ok(integration, `missing focused integrations.json entry for ${product.id}`);

    const operation = openapi.paths?.[product.endpoint]?.post;
    assert.ok(operation, `missing focused OpenAPI operation for ${product.id}`);
    assert.equal(operation["x-payment-info"]?.priceUsd, product.priceUsd);
  }
});


test("canonical preflight vocabulary covers broad buyer discovery intents", () => {
  const preflight = PAID_CAPABILITY_LIST.find((item) => item.id === "x402-payment-preflight");
  assert.ok(preflight);
  for (const phrase of [
    "x402 preflight",
    "verify endpoint before paying",
    "payTo verification",
    "USDC payment check",
    "api trust security preflight",
    "endpoint safety",
    "payment verification"
  ]) {
    assert.ok(
      (preflight.tags as readonly string[]).includes(phrase),
      `missing discovery phrase: ${phrase}`
    );
  }
});

test("focused public paid operations retain machine-invocable response schemas", () => {
  const x402 = readJson("public/.well-known/x402");
  const openapi = readJson("public/openapi.json");
  for (const id of ["x402-ping", "x402-payment-preflight", "verified-resolve", "batch-verified-resolve"]) {
    const product = PAID_CAPABILITY_LIST.find((item) => item.id === id);
    assert.ok(product, `missing paid product ${id}`);
    const resource = x402.resources.find((item: any) => item.resource === `POST ${product.endpoint}`);
    assert.ok(resource?.outputSchema, `missing focused x402 output schema for ${id}`);
    assert.ok(
      openapi.paths?.[product.endpoint]?.post?.responses?.["200"]?.content?.["application/json"]?.schema,
      `missing focused OpenAPI 200 response schema for ${id}`
    );
  }

  const sha256 = PAID_CAPABILITY_LIST.find((item) => item.id === "sha256");
  assert.ok(sha256);
  assert.equal(openapi.paths?.[sha256.endpoint], undefined);
});
