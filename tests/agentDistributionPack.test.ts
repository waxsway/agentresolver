import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentDistributionPackInput } from "../src/lib/agentDistributionPack";

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
