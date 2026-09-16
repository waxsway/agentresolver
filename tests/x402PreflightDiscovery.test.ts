import test from "node:test";
import assert from "node:assert/strict";
import { getPaidCapability } from "../src/lib/paidCapabilities";
import { X402_PREFLIGHT_OUTPUT_EXAMPLE, X402_PREFLIGHT_OUTPUT_SCHEMA } from "../src/lib/x402PreflightDiscovery";

test("canonical x402 preflight owns verify-before-pay buyer language", () => {
  const canonical = getPaidCapability("x402-payment-preflight");
  const legacy = getPaidCapability("http-inspect");

  assert.equal(canonical.endpoint, "/api/x402-payment-preflight");
  assert.match(canonical.name, /verify endpoint before paying/i);
  assert.ok(canonical.tags.includes("payTo verification"));
  assert.ok(canonical.tags.includes("USDC payment check"));

  assert.equal(legacy.endpoint, "/api/http-inspect");
  assert.match(legacy.name, /legacy/i);
  const legacyTags = new Set<string>(legacy.tags);
  assert.ok(!legacyTags.has("payTo verification"));
  assert.ok(!legacyTags.has("x402 preflight"));
});

test("canonical x402 preflight publishes a structured output contract", () => {
  assert.equal(X402_PREFLIGHT_OUTPUT_SCHEMA.type, "object");
  assert.deepEqual(
    X402_PREFLIGHT_OUTPUT_SCHEMA.required,
    ["url", "status", "ok", "latencyMs", "x402", "trust"]
  );
  assert.equal(X402_PREFLIGHT_OUTPUT_SCHEMA.properties.x402.type, "object");
  assert.equal(X402_PREFLIGHT_OUTPUT_SCHEMA.properties.trust.type, "object");

  assert.equal(X402_PREFLIGHT_OUTPUT_EXAMPLE.status, 402);
  assert.equal(X402_PREFLIGHT_OUTPUT_EXAMPLE.x402.detected, true);
  assert.equal(X402_PREFLIGHT_OUTPUT_EXAMPLE.x402.network, "eip155:8453");
  assert.equal(X402_PREFLIGHT_OUTPUT_EXAMPLE.x402.verdict, "strong");
  assert.equal(X402_PREFLIGHT_OUTPUT_EXAMPLE.trust.grade, "A");
});
