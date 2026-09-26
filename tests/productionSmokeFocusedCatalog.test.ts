import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const smoke = readFileSync(".github/workflows/production-smoke.yml", "utf8");

test("production smoke enforces the focused public revenue catalog", () => {
  assert.ok(smoke.includes("Focused public OpenAPI unexpectedly exposes MCP probe."));
  assert.doesNotMatch(smoke, /^\s*grep -F 'probeMcpEndpoint' \/tmp\/openapi\.json >\/dev\/null$/m);
  assert.match(smoke, /index\("x402-ping"\) != null/);
  assert.match(smoke, /index\("x402-payment-preflight"\) != null/);
  assert.match(smoke, /index\("verified-resolve"\) != null/);
  assert.match(smoke, /index\("batch-verified-resolve"\) != null/);
  assert.match(smoke, /index\("agent-distribution-pack"\) != null/);
  assert.match(smoke, /index\("provider-launch-check"\) != null/);
  assert.match(smoke, /index\("hash-encode"\) == null/);
  assert.match(smoke, /index\("mcp-probe"\) == null/);
});


test("production smoke requires and challenges the settlement verifier", () => {
  assert.match(smoke, /index\("x402-settlement-verify"\) != null/);
  assert.match(smoke, /x402SettlementVerifyGet/);
  assert.match(smoke, /check_402 'x402 Settlement Verify'/);
  assert.match(smoke, /get_path="\$path\?txHash=/);
});


test("production smoke validates the provider sponsorship contract instead of brittle CTA copy", () => {
  assert.match(smoke, /issues\/new\?template=sponsorship\.yml/);
  assert.doesNotMatch(smoke, /Apply for the sponsorship pilot/);
});


test("production smoke requires the seller-side Provider Launch Check discovery and challenge", () => {
  assert.match(smoke, /providerLaunchCheckGet/);
  assert.match(smoke, /check_402 'Provider Launch Check'/);
  assert.match(smoke, /'provider-launch-check' '50000'/);
});


test("production smoke requires the $5 seller Distribution Pack discovery and challenge", () => {
  assert.match(smoke, /agentDistributionPack/);
  assert.match(smoke, /check_402 'Agent Distribution Pack'/);
  assert.match(smoke, /'agent-distribution-pack' '5000000'/);
});
