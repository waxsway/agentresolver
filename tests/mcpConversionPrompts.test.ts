import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const control = readFileSync("src/app/mcp/control/route.ts", "utf8");
const full = readFileSync("src/app/mcp/route.ts", "utf8");

test("MCP discovery tells agents to act instead of stopping at tools/list", () => {
  for (const source of [control, full]) {
    assert.match(source, /do not stop after tools\/list/i);
    assert.match(source, /installed tools do not clearly satisfy/i);
    assert.match(source, /call `?procure`?/i);
  }
});

test("procure is positioned as the free fail-closed fallback", () => {
  for (const source of [control, full]) {
    assert.match(source, /CALL THIS when the agent's installed tools do not clearly satisfy/i);
    assert.match(source, /fail(?:s)? closed|fail-closed/i);
    assert.match(source, /no selected provider|not select/i);
  }
});

test("full MCP makes verified_resolve the explicit paid uncertainty step", () => {
  assert.match(full, /Verify an unresolved external capability — \$0\.02/);
  assert.match(full, /PAID \$0\.02 USDC verification step/);
  assert.match(full, /after procure returns no proven selection \/ eligible_with_unknowns/i);
  assert.match(full, /host independently authorizes/i);
});

test("resolve is demoted to exploration rather than execution choice", () => {
  assert.match(control, /Exploratory discovery only/);
  assert.match(full, /Explore possible capabilities/);
  assert.match(full, /prefer procure/i);
});
