import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("primary machine discovery exposes paid settlement receipt verification", () => {
  const x402 = JSON.parse(readFileSync("public/.well-known/x402", "utf8"));
  const card = readFileSync("src/app/mcp/server-card/route.ts", "utf8");
  const aiCatalog = readFileSync("src/app/.well-known/ai-catalog.json/route.ts", "utf8");
  const mcp = readFileSync("src/app/.well-known/mcp.json/route.ts", "utf8");
  const agent = JSON.parse(readFileSync("public/.well-known/agent.json", "utf8"));

  const resource = x402.resources.find((entry: { resource?: string }) =>
    entry.resource === "GET /api/x402-settlement-verify"
  );
  assert.ok(resource);
  assert.equal(resource.price, "$0.001");
  assert.deepEqual(resource.inputSchema.required, ["txHash"]);
  assert.match(resource.description, /payment receipt/i);

  assert.match(card, /settlement-receipt verification/i);
  assert.match(aiCatalog, /settlement-receipt verification/i);
  assert.match(aiCatalog, /PaymentReceiptVerification/);
  assert.match(mcp, /settlement-receipt verification/i);
  assert.match(mcp, /independently checked/i);

  const intent = agent.intents.find((entry: { name?: string }) =>
    entry.name === "x402_settlement_verify"
  );
  assert.ok(intent);
  assert.equal(intent.endpoint, "/api/x402-settlement-verify");
  assert.equal(intent.method, "GET");
  assert.equal(intent.price.amount, 0.001);
  assert.deepEqual(intent.required_query, ["txHash"]);
});
