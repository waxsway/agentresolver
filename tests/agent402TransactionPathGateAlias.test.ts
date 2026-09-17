import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getTransactionPathGate } from "../src/app/api/x402-transaction-path-payment-gate/route";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

const id = "x402-transaction-path-payment-gate";
const name = "X402 Transaction Path Payment Gate";
const endpoint = "/api/x402-transaction-path-payment-gate";

test("transaction-path alias binds its 402 challenge to its own URL", async () => {
  const response = await getTransactionPathGate(new NextRequest(`https://agentresolver.vercel.app${endpoint}`, {
    method: "GET",
    headers: { "user-agent": "agentresolver-test", "x-agentresolver-internal": "1" }
  }));
  assert.equal(response.status, 402);
  const body = await response.json() as any;
  assert.equal(body.resource?.url, `https://agentresolver.vercel.app${endpoint}`);
  assert.equal(body.extensions?.agentresolver?.capabilityId, "x402-payment-preflight");
  assert.ok(body.accepts?.some((item: any) => item.network === "eip155:8453" && item.amount === "1000"));
  assert.ok(body.accepts?.some((item: any) => item.network === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" && item.amount === "1000"));
});

test("generated discovery surfaces publish transaction-path alias", () => {
  const manifest = readJson("public/.well-known/x402");
  const openapi = readJson("public/openapi.json");

  const resource = manifest.resources.find((item: any) => item.id === id);
  assert.ok(resource, "manifest resource");
  assert.equal(resource.name, name);
  assert.equal(resource.slug, id);
  assert.equal(resource.resource, `POST ${endpoint}`);
  assert.equal(resource.endpoint, `https://agentresolver.vercel.app${endpoint}`);
  assert.ok(resource.accepts?.every((item: any) => item.resource === `https://agentresolver.vercel.app${endpoint}`));

  const service = manifest.services.find((item: any) => item.id === id);
  assert.ok(service, "manifest service");
  assert.equal(service.name, name);
  assert.equal(service.endpoint, `https://agentresolver.vercel.app${endpoint}`);

  const operation = openapi.paths?.[endpoint]?.post;
  assert.ok(operation, "OpenAPI operation");
  assert.equal(operation.summary, name);
  assert.equal(operation.operationId, "x402TransactionPathPaymentGate");
  assert.equal(operation["x-payment-info"]?.priceUsd, 0.001);
});
