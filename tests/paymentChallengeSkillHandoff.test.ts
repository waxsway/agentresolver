import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("paid HTTP responses expose the installable Guard skill handoff", () => {
  const route = readFileSync("src/lib/createDeterministicPaidRoute.ts", "utf8");
  assert.match(route, /x-agentresolver-agent-skills/);
  assert.match(route, /x-agentresolver-payment-guard-skill/);
  assert.match(route, /AGENT_SKILLS_INDEX_URL/);
  assert.match(route, /PAYMENT_GUARD_SKILL_URL/);
  assert.match(route, /access-control-expose-headers/);
});

test("buyer setup exports canonical Agent Skills discovery URLs", () => {
  const setup = readFileSync("src/lib/x402BuyerSetup.ts", "utf8");
  assert.match(setup, /\.well-known\/agent-skills\/index\.json/);
  assert.match(setup, /agentresolver-payment-guard\/SKILL\.md/);
});
