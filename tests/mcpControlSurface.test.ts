import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/app/mcp/control/route.ts", "utf8");
const toolNames = [...source.matchAll(/server\.registerTool\(\s*"([^"]+)"/g)].map((match) => match[1]);

test("lean MCP control plane exposes exactly procure and resolve", () => {
  assert.deepEqual(toolNames, ["procure", "resolve"]);
  assert.doesNotMatch(source, /payment_guard/);
  assert.doesNotMatch(source, /createLazyPaidMcpTool/);
});

test("lean MCP control plane describes caller-facing parameters", () => {
  assert.match(source, /goal:[\s\S]*?\.describe\(/);
  assert.match(source, /maxPriceUsd:[\s\S]*?\.describe\(/);
  assert.match(source, /preferredNetworks:[\s\S]*?\.describe\(/);
  assert.match(source, /requiredOutputSchema:[\s\S]*?\.describe\(/);
  assert.match(source, /sideEffect:[\s\S]*?\.describe\(/);
  assert.match(source, /auth:[\s\S]*?\.describe\(/);
});

test("lean MCP control plane keeps custody and spending boundaries explicit", () => {
  assert.match(source, /callerWalletControlledByAgentResolver:\s*false/);
  assert.match(source, /callerSpendAuthorizedByAgentResolver:\s*false/);
  assert.match(source, /arbitraryProxying:\s*false/);
  assert.match(source, /unknownMetadataIsNotTreatedAsVerified:\s*true/);
  assert.match(source, /fullCatalog:[\s\S]*?\/mcp/);
});
