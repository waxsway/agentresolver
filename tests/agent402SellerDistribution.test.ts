import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/register-agent402.yml", "utf8");

test("Agent402 refresh verifies the live $5 Distribution Pack before reindexing", () => {
  assert.match(workflow, /api\/agent-distribution-pack/);
  assert.match(workflow, /5000000/);
  assert.match(workflow, /agent-distribution-pack/);
});

test("Agent402 ranking audit measures seller distribution intent", () => {
  for (const phrase of [
    "agent distribution",
    "API agent distribution",
    "MCP discoverability",
    "MCP distribution",
    "agent service launch",
    "API discoverability for AI agents",
    "provider launch check"
  ]) {
    assert.ok(workflow.includes(`"${phrase}"`), `missing seller-intent query: ${phrase}`);
  }
});
