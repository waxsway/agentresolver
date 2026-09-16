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
    assert.equal(x402Resource.accepts?.length, 2);
    assert.equal(x402Resource.accepts?.[0]?.network, "eip155:8453");
    assert.equal(x402Resource.accepts?.[1]?.network, "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
    assert.equal(x402Resource.accepts?.[1]?.payTo, "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa");

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
    assert.deepEqual(operation["x-payment-info"]?.networks, [
      "eip155:8453",
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
    ]);
    assert.equal(operation["x-agentresolver-product"]?.id, product.id);
  }
});


test("deterministic utility discovery publishes response schemas", () => {
  const x402 = readJson("public/.well-known/x402");
  const openapi = readJson("public/openapi.json");
  const ids = [
    "abi-encode",
    "abi-decode",
    "eip712-hash",
    "ens-namehash",
    "evm-address-checksum",
    "keccak256",
    "solidity-selector",
    "evm-units",
    "x402-ping",
    "sha256",
    "sha512",
    "hmac-sha256",
    "base64-encode",
    "base64-decode",
    "jwt-decode",
    "json-normalize",
    "json-schema-validate",
    "url-parse",
    "uuid-v4",
    "slugify"
  ];

  for (const id of ids) {
    const product = PAID_CAPABILITY_LIST.find((item) => item.id === id);
    assert.ok(product, `missing paid product ${id}`);
    const resource = x402.resources.find((item: any) => item.resource === `POST ${product.endpoint}`);
    assert.ok(resource?.outputSchema, `missing x402 output schema for ${id}`);
    assert.ok(
      openapi.paths?.[product.endpoint]?.post?.responses?.["200"]?.content?.["application/json"]?.schema,
      `missing OpenAPI 200 response schema for ${id}`
    );
  }
});


test("canonical x402 preflight explicitly covers broad buyer-safety discovery intents", () => {
  const product = PAID_CAPABILITY_LIST.find((item) => item.id === "x402-payment-preflight");
  assert.ok(product);
  const searchText = [
    product.name,
    product.description,
    product.useWhen,
    ...product.tags,
    product.quoteTool.title,
    product.quoteTool.description
  ].join(" ").toLowerCase();

  for (const phrase of [
    "x402 payment preflight",
    "verify endpoint before paying",
    "endpoint safety",
    "api trust",
    "security preflight",
    "payto verification",
    "usdc payment check",
    "verify-before-pay"
  ]) {
    assert.ok(searchText.includes(phrase), `missing discovery phrase: ${phrase}`);
  }
});
