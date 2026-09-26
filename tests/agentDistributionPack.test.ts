import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { parseAgentDistributionPackInput } from "../src/lib/agentDistributionPack";
import { GET } from "../src/app/api/agent-distribution-pack/route";

test("distribution pack accepts a bounded same-origin seller launch packet", () => {
  const parsed = parseAgentDistributionPackInput({
    providerName: "Example API",
    description: "Current structured data for autonomous agents.",
    origin: "https://api.example.com",
    primaryEndpoint: "https://api.example.com/v1/search",
    openapiUrl: "https://api.example.com/openapi.json",
    mcpName: "com.example/api",
    mcpEndpoint: "https://api.example.com/mcp",
    repositoryUrl: "https://github.com/example/api",
    version: "1.2.3",
    tags: ["Search", "Agents"]
  });

  assert.equal(parsed.origin, "https://api.example.com/");
  assert.equal(parsed.primaryEndpoint, "https://api.example.com/v1/search");
  assert.equal(parsed.mcpName, "com.example/api");
  assert.deepEqual(parsed.tags, ["search", "agents"]);
});

test("distribution pack rejects cross-origin callable metadata", () => {
  assert.throws(() => parseAgentDistributionPackInput({
    providerName: "Example API",
    description: "Current structured data for autonomous agents.",
    origin: "https://api.example.com",
    primaryEndpoint: "https://other.example.com/v1/search"
  }), /primaryEndpoint must share the declared origin/);
});

test("distribution pack rejects credential-bearing origins", () => {
  assert.throws(() => parseAgentDistributionPackInput({
    providerName: "Example API",
    description: "Current structured data for autonomous agents.",
    origin: "https://user:pass@example.com"
  }), /public HTTPS URL/);
});


test("distribution pack survives focused public catalog compaction", () => {
  const x402 = JSON.parse(readFileSync("public/.well-known/x402", "utf8"));
  const capabilities = JSON.parse(readFileSync("public/capabilities.json", "utf8"));
  const openapi = JSON.parse(readFileSync("public/openapi.json", "utf8"));

  assert.ok(x402.services.some((item: { id?: string; price_usdc?: string }) =>
    item.id === "agent-distribution-pack" && item.price_usdc === "5"
  ));
  assert.ok(x402.resources.some((item: { id?: string; resource?: string }) =>
    item.id === "agent-distribution-pack" &&
    item.resource === "POST /api/agent-distribution-pack"
  ));
  assert.ok(capabilities.capabilities.some((item: { id?: string; priceUsd?: number }) =>
    item.id === "agent-distribution-pack" && item.priceUsd === 5
  ));
  assert.equal(
    openapi.paths["/api/agent-distribution-pack"].post.operationId,
    "agentDistributionPack"
  );
});


test("distribution pack exposes a browser-safe unpaid GET quote", async () => {
  const response = await GET(new NextRequest(
    "https://agentresolver.vercel.app/api/agent-distribution-pack",
    { headers: { "user-agent": "agentresolver-test" } }
  ));
  assert.equal(response.status, 402);
  const body = await response.json() as any;
  assert.equal(body.x402Version, 2);
  assert.ok(Array.isArray(body.accepts));
  assert.ok(body.accepts.some((item: any) => String(item.amount) === "5000000"));
});
