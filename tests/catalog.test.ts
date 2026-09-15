import test from "node:test";
import assert from "node:assert/strict";
import { resolveCapabilities } from "../src/lib/catalog";

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
