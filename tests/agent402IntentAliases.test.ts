import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getX402Preflight } from "../src/app/api/x402-preflight/route";
import { GET as getPrepaymentGate } from "../src/app/api/prepayment-authorization-gate/route";
import { GET as getApiTrustPreflight } from "../src/app/api/api-trust-security-preflight/route";
import { GET as getTransactionPathGate } from "../src/app/api/x402-transaction-path-payment-gate/route";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

const aliases = [
  {
    id: "x402-preflight",
    name: "X402 Preflight",
    endpoint: "/api/x402-preflight",
    get: getX402Preflight
  },
  {
    id: "prepayment-authorization-gate",
    name: "Prepayment Authorization Gate",
    endpoint: "/api/prepayment-authorization-gate",
    get: getPrepaymentGate
  },
  {
    id: "api-trust-security-preflight",
    name: "API Trust Security Preflight",
    endpoint: "/api/api-trust-security-preflight",
    get: getApiTrustPreflight
  },
  {
    id: "x402-transaction-path-payment-gate",
    name: "X402 Transaction Path Payment Gate",
    endpoint: "/api/x402-transaction-path-payment-gate",
    get: getTransactionPathGate
  }
] as const;

test("exact-intent aliases bind 402 discovery to their own resource URLs", async () => {
  for (const alias of aliases) {
    const response = await alias.get(new NextRequest(`https://agentresolver.vercel.app${alias.endpoint}`, {
      method: "GET",
      headers: { "user-agent": "agentresolver-test", "x-agentresolver-internal": "1" }
    }));
    assert.equal(response.status, 402, alias.id);
    const body = await response.json() as any;
    assert.equal(body.resource?.url, `https://agentresolver.vercel.app${alias.endpoint}`, alias.id);
    assert.equal(body.extensions?.agentresolver, undefined, alias.id);
    assert.ok(body.extensions?.bazaar?.info, alias.id);
    assert.ok(body.extensions?.bazaar?.schema, alias.id);
    assert.ok(body.accepts?.some((item: any) => item.network === "eip155:8453" && item.amount === "1000"), alias.id);
    assert.ok(body.accepts?.some((item: any) => item.network === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" && item.amount === "1000"), alias.id);
  }
});

test("generated Agent402 surfaces publish literal intent aliases", () => {
  const manifest = readJson("public/.well-known/x402");
  const openapi = readJson("public/openapi.json");

  assert.equal(openapi.info.version, "0.1.9");
  for (const alias of aliases) {
    const resource = manifest.resources.find((item: any) => item.id === alias.id);
    assert.ok(resource, `${alias.id} manifest resource`);
    assert.equal(resource.name, alias.name);
    assert.equal(resource.slug, alias.id);
    assert.equal(resource.resource, `POST ${alias.endpoint}`);
    assert.equal(resource.endpoint, `https://agentresolver.vercel.app${alias.endpoint}`);
    assert.ok(resource.accepts?.every((item: any) => item.resource === `https://agentresolver.vercel.app${alias.endpoint}`));

    const service = manifest.services.find((item: any) => item.id === alias.id);
    assert.ok(service, `${alias.id} manifest service`);
    assert.equal(service.name, alias.name);
    assert.equal(service.endpoint, `https://agentresolver.vercel.app${alias.endpoint}`);

    const operation = openapi.paths?.[alias.endpoint]?.post;
    assert.ok(operation, `${alias.id} OpenAPI operation`);
    assert.equal(operation.summary, alias.name);
    assert.equal(operation["x-payment-info"]?.priceUsd, 0.001);
  }
});
