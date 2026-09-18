import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/register-agent402.yml", "utf8");

test("Agent402 audit measures post-payment settlement verification buyer intent", () => {
  assert.match(workflow, /"x402 settlement verification"/);
  assert.match(workflow, /"verify x402 settlement receipt"/);
  assert.match(workflow, /"Base USDC settlement verification"/);
  assert.match(workflow, /agentresolverRank/);
  assert.match(workflow, /executeViaCallableNow/);
});
