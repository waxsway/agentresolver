import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/app/mcp/route.ts", "utf8");

function registrationBlock(tool: string) {
  const start = source.indexOf(`server.registerTool("${tool}"`);
  assert.notEqual(start, -1, `missing MCP tool ${tool}`);
  const end = source.indexOf("));", start);
  assert.notEqual(end, -1, `unterminated MCP tool ${tool}`);
  return source.slice(start, end);
}

test("first-purchase MCP ping declares a structured output contract and repeat-purchase handoff", () => {
  const block = registrationBlock("x402_ping");
  assert.match(block, /outputSchema:\s*x402PingMcpOutputSchema/);
  assert.match(source, /const x402PingMcpOutputSchema = z\.object\(\{/);
  assert.match(source, /settledDelivery:\s*z\.literal\(true\)/);
  assert.match(source, /requestId:\s*z\.string\(\)/);
  assert.match(source, /next:\s*z\.object\(\{/);
  assert.match(source, /settlementVerify:\s*x402PingNextActionSchema\.extend\(\{/);
  assert.match(source, /transactionHashSource:\s*z\.literal\("payment-response\.transaction"\)/);
  assert.match(source, /paymentAuthorization:\s*z\.literal\("separate_caller_authorization_required"\)/);
  assert.match(block, /next:\s*X402_PING_NEXT_ACTIONS/);
});

test("post-ping hash utility declares its deterministic result contract", () => {
  const block = registrationBlock("hash_encode");
  assert.match(block, /outputSchema:\s*hashEncodeMcpOutputSchema/);
  assert.match(source, /operation:\s*z\.literal\("jwt-decode"\)/);
  assert.match(source, /result:\s*z\.string\(\)/);
});

test("Guard aliases publish the same fail-closed MCP output contract", () => {
  for (const tool of ["payment_guard", "x402_payment_preflight"]) {
    const block = registrationBlock(tool);
    assert.match(block, /outputSchema:\s*paymentGuardMcpOutputSchema/);
  }
  assert.match(source, /decision:\s*z\.enum\(\["eligible", "blocked"\]\)/);
  assert.match(source, /eligibleForCallerAuthorization:\s*z\.boolean\(\)/);
});
