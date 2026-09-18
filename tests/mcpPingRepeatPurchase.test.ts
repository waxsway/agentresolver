import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { X402_PING_NEXT_ACTIONS } from "../src/lib/x402PingDiscovery";

test("MCP x402 ping declares its output contract and returns repeat-purchase handoff", () => {
  const source = readFileSync("src/app/mcp/route.ts", "utf8");

  assert.match(source, /outputSchema:\s*x402PingMcpOutputSchema/);
  assert.match(source, /next:\s*X402_PING_NEXT_ACTIONS/);
  assert.equal(X402_PING_NEXT_ACTIONS.recommended.capabilityId, "hash-encode");
  assert.equal(X402_PING_NEXT_ACTIONS.recommended.method, "GET");
  assert.equal(X402_PING_NEXT_ACTIONS.recommended.priceUsd, 0.001);
  assert.equal(
    X402_PING_NEXT_ACTIONS.recommended.paymentAuthorization,
    "separate_caller_authorization_required"
  );
});
