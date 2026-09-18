import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("service-level machine discovery leads with paid x402 payment verification", () => {
  const card = readFileSync("src/app/mcp/server-card/route.ts", "utf8");
  const aiCatalog = readFileSync("src/app/.well-known/ai-catalog.json/route.ts", "utf8");
  const mcp = readFileSync("src/app/.well-known/mcp.json/route.ts", "utf8");
  const agent = JSON.parse(readFileSync("public/.well-known/agent.json", "utf8"));

  assert.match(card, /settlement-receipt verification/i);
  assert.match(aiCatalog, /settlement-receipt verification/i);
  assert.match(aiCatalog, /PaymentReceiptVerification/);
  assert.match(mcp, /settlement-receipt verification/i);
  assert.match(mcp, /independently checked/i);

  assert.match(agent.description, /settlement-receipt verification/i);
  const intent = agent.intents.find((entry: { name?: string }) =>
    entry.name === "x402_settlement_receipt_verify"
  );
  assert.ok(intent);
  assert.equal(intent.endpoint, "/api/x402-settlement-verify");
  assert.equal(intent.method, "GET");
  assert.equal(intent.price.amount, 0.001);
  assert.deepEqual(intent.required_query, ["txHash"]);
  assert.match(intent.description, /payment receipt/i);
  assert.match(intent.description, /transaction hash/i);
});

test("CDP retry telemetry allowlists bounded top-level facilitator error reasons", () => {
  const telemetry = readFileSync("src/lib/telemetry.ts", "utf8");
  assert.match(telemetry, /"errorType",\s*"error"/);
});
