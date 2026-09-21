import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("A2A discovery card exposes paid Guard without moving payment custody", () => {
  const card = readFileSync(
    "src/app/.well-known/agent-card.json/route.ts",
    "utf8",
  );
  const route = readFileSync("src/app/a2a/route.ts", "utf8");

  assert.match(card, /protocolVersion:\s*"0\.3\.0"/);
  assert.match(card, /preferredTransport:\s*"JSONRPC"/);
  assert.match(card, /verify_x402_before_paying/);
  assert.match(card, /Verify x402 Payment Before Paying/);
  assert.match(card, /\$0\.001 USDC/);
  assert.match(route, /message\/send/);
  assert.match(route, /\/api\/x402-payment-preflight/);
  assert.match(route, /\/api\/verified-resolve/);
  assert.match(route, /nonCustodial:\s*true/);
  assert.match(route, /signsPayments:\s*false/);
  assert.doesNotMatch(route, /private.?key|seed phrase|broadcastTransaction|sendTransaction/i);
});
