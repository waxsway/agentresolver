import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

test("top-level discovery publishes the x402 settlement receipt verifier", () => {
  const catalog = readJson("public/.well-known/x402-catalog.json");
  const resource = catalog.resources?.find((item: any) => item.id === "x402-settlement-verify");
  assert.ok(resource, "x402 catalog must expose settlement receipt verification");
  assert.equal(resource.method, "GET");
  assert.equal(resource.preferredMethod, "GET");
  assert.equal(resource.url, "https://agentresolver.vercel.app/api/x402-settlement-verify");
  assert.equal(resource.price?.amountUsd, 0.001);
  assert.equal(resource.input?.required?.[0], "txHash");
  assert.match(resource.description ?? "", /settlement evidence/i);

  const agent = readJson("public/.well-known/agent.json");
  const intent = agent.intents?.find((item: any) => item.name === "x402_settlement_verify");
  assert.ok(intent, "agent intent manifest must expose settlement receipt verification");
  assert.equal(intent.method, "GET");
  assert.equal(intent.preferred_method, "GET");
  assert.equal(intent.endpoint, "/api/x402-settlement-verify");
  assert.equal(intent.price?.amount, 0.001);
  assert.deepEqual(intent.required_query, ["txHash"]);
  assert.match((intent.tags ?? []).join(" "), /transaction receipt verify/i);

  const llms = readFileSync("public/llms.txt", "utf8");
  assert.match(llms, /## Settlement receipt verification/);
  assert.match(llms, /GET https:\/\/agentresolver\.vercel\.app\/api\/x402-settlement-verify\?txHash=<base-transaction-hash>/);
  assert.match(llms, /Price: \$0\.001 USDC on Base or Solana\./);
});
