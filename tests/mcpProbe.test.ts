import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMcpEndpoint } from "../src/lib/mcpProbe";

test("normalizes a public MCP endpoint and preserves its path", () => {
  const url = normalizeMcpEndpoint("https://example.com/mcp");
  assert.equal(url.toString(), "https://example.com/mcp");
});

test("defaults an endpoint without a scheme to https", () => {
  const url = normalizeMcpEndpoint("example.com/mcp");
  assert.equal(url.toString(), "https://example.com/mcp");
});

test("rejects localhost and private IPv4 targets", () => {
  assert.throws(() => normalizeMcpEndpoint("http://localhost/mcp"));
  assert.throws(() => normalizeMcpEndpoint("http://127.0.0.1/mcp"));
  assert.throws(() => normalizeMcpEndpoint("http://10.0.0.1/mcp"));
  assert.throws(() => normalizeMcpEndpoint("http://192.168.1.1/mcp"));
});

test("rejects credentials and nonstandard ports", () => {
  assert.throws(() => normalizeMcpEndpoint("https://user:pass@example.com/mcp"));
  assert.throws(() => normalizeMcpEndpoint("https://example.com:8443/mcp"));
});
