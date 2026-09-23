import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("homepage routes API-company prospects to the fixed-price MCP sprint", () => {
  const home = readFileSync("src/app/page.tsx", "utf8");
  assert.match(home, /href="\/mcp-sprint"/);
  assert.match(home, /fixed \$1,000 implementation sprint/i);
});

test("MCP sprint page preserves the locked commercial scope", () => {
  const page = readFileSync("src/app/mcp-sprint/page.tsx", "utf8");
  for (const phrase of [
    "Fixed fee: $1,000",
    "Start payment: $500",
    "Handoff payment: $500",
    "up to 5 existing API operations",
    "your company owns the delivered code",
    "Recurring AgentResolver fee: none for this sprint",
    "guarantee agent traffic or revenue"
  ]) {
    assert.ok(page.includes(phrase), `missing locked sprint term: ${phrase}`);
  }
});
