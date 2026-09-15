import test from "node:test";
import assert from "node:assert/strict";
import { CAPABILITIES, resolveCapabilities } from "../src/lib/catalog";
import { PAID_CAPABILITY_LIST } from "../src/lib/paidCapabilities";

test("ranks wallet risk for AML wallet analysis", () => {
  const matches = resolveCapabilities(
    "analyze an ethereum wallet for AML risk and compliance",
    3
  );

  assert.equal(matches[0]?.id, "wallet-risk");
});

test("ranks web extraction for webpage extraction goals", () => {
  const matches = resolveCapabilities(
    "extract structured data from this webpage url",
    3
  );

  assert.equal(matches[0]?.id, "web-extract");
});

test("ranks capability search for tool discovery", () => {
  const matches = resolveCapabilities(
    "find an MCP tool or API for this task",
    3
  );

  assert.equal(matches[0]?.id, "capability-search");
});

test("returns the live paid MCP probe with executable payment metadata", () => {
  const matches = resolveCapabilities(
    "verify this MCP endpoint and list its tools",
    3
  );

  assert.equal(matches[0]?.id, "mcp-probe");
  assert.equal(matches[0]?.status, "live");
  assert.equal(matches[0]?.endpoint, "/api/mcp-probe");
  assert.equal(matches[0]?.priceUsd, 0.001);
  assert.equal(matches[0]?.payment?.protocol, "x402");
  assert.equal(matches[0]?.payment?.network, "eip155:8453");
  assert.equal(matches[0]?.payment?.asset, "USDC");
});

test("returns the live paid readiness audit with executable payment metadata", () => {
  const matches = resolveCapabilities(
    "audit this website for agent readiness llms.txt and OpenAPI",
    3
  );

  assert.equal(matches[0]?.id, "agent-readiness");
  assert.equal(matches[0]?.status, "live");
  assert.equal(matches[0]?.endpoint, "/api/agent-readiness");
  assert.equal(matches[0]?.priceUsd, 0.005);
  assert.equal(matches[0]?.payment?.protocol, "x402");
  assert.equal(matches[0]?.payment?.network, "eip155:8453");
  assert.equal(matches[0]?.payment?.asset, "USDC");
});

test("never returns more than ten owned matches", () => {
  const matches = resolveCapabilities(
    "tool api mcp search web extract javascript render pdf document vendor domain wallet crypto risk",
    99
  );

  assert.ok(matches.length <= 10);
});

test("returns no owned match for an unrelated empty-intent query", () => {
  assert.deepEqual(resolveCapabilities("zzzzzzzzzz", 3), []);
});

test("free resolver catalog stays in lockstep with the canonical paid product registry", () => {
  for (const product of PAID_CAPABILITY_LIST) {
    const capability = CAPABILITIES.find((item) => item.id === product.id);
    assert.ok(capability, `resolver catalog missing ${product.id}`);
    assert.equal(capability.status, "live");
    assert.equal(capability.endpoint, product.endpoint);
    assert.equal(capability.priceUsd, product.priceUsd);
    assert.equal(capability.payment?.protocol, "x402");
  }
});

test("ranks direct HTTP inspection for current endpoint evidence", () => {
  const matches = resolveCapabilities(
    "inspect this https url for status latency cache headers and security headers",
    3
  );
  assert.equal(matches[0]?.id, "http-inspect");
  assert.equal(matches[0]?.priceUsd, 0.001);
});

test("ranks tool contract fit for structured workflow compatibility", () => {
  const matches = resolveCapabilities(
    "check tool contract json schema workflow compatibility mapping",
    3
  );
  assert.equal(matches[0]?.id, "tool-contract");
  assert.equal(matches[0]?.priceUsd, 0.005);
});
