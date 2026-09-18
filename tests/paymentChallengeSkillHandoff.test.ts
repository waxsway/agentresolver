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


test("standard Link header exposes the free x402 buyer setup", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(
    config,
    /<https:\/\/agentresolver\.vercel\.app\/api\/x402-client-setup>; rel=\\\"help\\\"; type=\\\"application\/json\\\"/
  );
  assert.match(config, /AgentResolver x402 buyer setup/);
});


test("browser clients can read the standard buyer setup Link handoff", () => {
  const paidRoute = readFileSync("src/lib/createDeterministicPaidRoute.ts", "utf8");
  const discovery = readFileSync("src/lib/x402DiscoveryChallenge.ts", "utf8");
  const guard = readFileSync("src/app/api/payment-guard/route.ts", "utf8");
  const preflight = readFileSync("src/app/api/x402-payment-preflight/route.ts", "utf8");

  assert.match(paidRoute, /"payment-response",\s*"link",\s*"x-agentresolver-capability"/);
  assert.match(discovery, /"access-control-expose-headers": "payment-required, link"/);
  assert.match(
    guard,
    /"access-control-expose-headers": "link, x-agentresolver-buyer-setup, x-agentresolver-payment-guard"/
  );
  assert.match(
    preflight,
    /"access-control-expose-headers": "link, x-agentresolver-buyer-setup, x-agentresolver-payment-guard"/
  );
});
