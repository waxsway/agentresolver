import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const llms = readFileSync("public/llms.txt", "utf8");
const full = readFileSync("public/llms-full.txt", "utf8");
const guide = readFileSync("public/agentresolver.md", "utf8");
const agentsText = readFileSync("public/agents.txt", "utf8");
const agentsJson = JSON.parse(readFileSync("public/agents.json", "utf8")) as any;
const agentCard = JSON.parse(readFileSync("public/.well-known/agent.json", "utf8")) as any;

test("machine docs make AgentResolver Guard GET-first and repeat-use", () => {
  for (const text of [llms, full, guide, agentsText]) {
    assert.match(text, /AgentResolver Guard|payment_guard/);
    assert.match(text, /api\/payment-guard/);
    assert.match(text, /GET/);
    assert.match(text, /authoriz/i);
  }

  assert.match(llms, /before (?:each|the next) .*x402 spend/i);
  assert.match(full, /before each autonomous payment/i);
  assert.match(guide, /target 402.*Guard.*caller authorization.*target signed retry/is);
  assert.match(agentsText, /Repeat-Use: before_each_autonomous_x402_spend/);
});

test("structured agent surfaces publish Guard as GET-first without breaking canonical identity", () => {
  const guard = agentsJson.capabilities.find((item: any) => item.id === "payment_guard");
  assert.equal(guard.canonicalCapabilityId, "x402-payment-preflight");
  assert.equal(guard.method, "GET");
  assert.equal(guard.preferredMethod, "GET");
  assert.deepEqual(guard.methods, ["GET", "POST"]);
  assert.equal(guard.endpoint, "https://agentresolver.vercel.app/api/payment-guard");
  assert.deepEqual(guard.requiredQuery, ["url"]);
  assert.equal(guard.repeatUse, "before_each_autonomous_x402_spend");
  assert.deepEqual(guard.payment.networks, ["base", "solana"]);
  assert.equal(guard.spendingAuthorized, false);

  const intent = agentCard.intents.find((item: any) => item.name === "x402_payment_preflight");
  assert.equal(intent.brand, "AgentResolver Guard");
  assert.equal(intent.endpoint, "/api/x402-payment-preflight");
  assert.equal(intent.alias_endpoint, "/api/payment-guard");
  assert.equal(intent.method, "GET");
  assert.deepEqual(intent.methods, ["GET", "POST"]);
  assert.deepEqual(intent.required_query, ["url"]);
  assert.equal(intent.repeat_use, "before_each_autonomous_x402_spend");
  assert.equal(intent.spending_authorized, false);
});

test("machine docs expose the payment-capable buyer handoff", () => {
  for (const text of [llms, full, guide]) {
    assert.match(text, /api\/x402-client-setup/);
    assert.match(text, /@x402\/fetch/);
    assert.match(text, /@x402\/mcp/);
  }
  assert.equal(
    agentsJson.discovery.buyerSetup,
    "https://agentresolver.vercel.app/api/x402-client-setup"
  );
  assert.equal(
    agentCard.buyer_setup,
    "https://agentresolver.vercel.app/api/x402-client-setup"
  );
});

test("MCP docs advertise payment_guard and preserve free resolve", () => {
  for (const text of [llms, full, guide]) {
    assert.match(text, /payment_guard/);
    assert.match(text, /resolve/);
  }
});

test("short machine instructions no longer tell buyers to use POST as the primary preflight path", () => {
  assert.doesNotMatch(
    llms,
    /Before authorizing USDC, call POST https:\/\/agentresolver\.vercel\.app\/api\/x402-payment-preflight/
  );
  assert.match(
    llms,
    /GET https:\/\/agentresolver\.vercel\.app\/api\/payment-guard\?url=/
  );
  assert.match(llms, /POST remains supported/i);
});
