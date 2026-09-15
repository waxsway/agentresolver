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

test("generated machine surfaces contain every registered paid capability", () => {
  const x402 = readJson("public/.well-known/x402");
  const capabilities = readJson("public/capabilities.json");
  const integrations = readJson("public/integrations.json");
  const openapi = readJson("public/openapi.json");

  for (const product of PAID_CAPABILITY_LIST) {
    const x402Resource = x402.resources.find((item: any) => item.resource === `POST ${product.endpoint}`);
    assert.ok(x402Resource, `missing x402 resource for ${product.id}`);
    assert.equal(x402Resource.price, product.price);
    assert.equal(x402Resource.accepts?.[0]?.amount, product.atomicAmount);
    assert.equal(x402Resource.accepts?.[0]?.maxAmountRequired, product.atomicAmount);
    assert.equal(x402Resource.accepts?.[0]?.resource, `${CANONICAL_ORIGIN}${product.endpoint}`);

    const capability = capabilities.capabilities.find((item: any) => item.id === product.id);
    assert.ok(capability, `missing capabilities.json entry for ${product.id}`);
    assert.equal(capability.endpoint, product.endpoint);
    assert.equal(capability.priceUsd, product.priceUsd);

    const integration = integrations.paidActions.find((item: any) => item.id === product.id);
    assert.ok(integration, `missing integrations.json entry for ${product.id}`);
    assert.equal(integration.url, `${CANONICAL_ORIGIN}${product.endpoint}`);
    assert.equal(integration.priceUsd, product.priceUsd);

    const operation = openapi.paths?.[product.endpoint]?.post;
    assert.ok(operation, `missing OpenAPI operation for ${product.id}`);
    assert.equal(operation["x-payment-info"]?.priceUsd, product.priceUsd);
    assert.equal(operation["x-agentresolver-product"]?.id, product.id);
  }
});
