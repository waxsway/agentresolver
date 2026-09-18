import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { x402DiscoveryChallenge } from "../src/lib/x402DiscoveryChallenge";

test("paid discovery challenge exposes Bazaar input/output schemas and dual rails", async () => {
  const response = x402DiscoveryChallenge("x402-payment-preflight");
  assert.equal(response.status, 402);

  const body = await response.json() as any;
  assert.equal(body.x402Version, 2);
  assert.ok(body.extensions?.bazaar?.schema?.properties?.input);
  assert.ok(body.extensions?.bazaar?.schema?.properties?.output);

  assert.ok(body.accepts.some((item: any) => item.network === "eip155:8453"));
  assert.ok(body.accepts.some((item: any) =>
    item.network === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" &&
    item.payTo === "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa"
  ));

  assert.ok(response.headers.get("payment-required"));
  assert.equal(body.resource.serviceName, "AgentResolver");
  assert.ok(body.resource.description.length <= 240);
  assert.ok(body.resource.tags.length <= 5);
  assert.ok(body.resource.tags.every((tag: string) => tag.length <= 32 && /^[\x20-\x7E]+$/.test(tag)));
  assert.deepEqual(
    body.resource.tags,
    ["x402 preflight", "verify endpoint before paying", "payTo verification", "USDC payment check", "api trust security preflight"]
  );
});


test("x402 challenges expose bounded buyer recovery directly in the 402 extensions", async () => {
  const response = x402DiscoveryChallenge("x402-ping");
  const body = await response.json() as any;
  const recovery = body.extensions?.agentresolver;

  assert.equal(recovery?.schemaVersion, 1);
  assert.equal(recovery?.capabilityId, "x402-ping");
  assert.equal(recovery?.priceUsd, 0.001);
  assert.equal(recovery?.buyerSetup, "https://agentresolver.vercel.app/api/x402-client-setup");
  assert.equal(recovery?.paymentGuard, "https://agentresolver.vercel.app/api/payment-guard");
  assert.equal(
    recovery?.paymentGuardSkill,
    "https://agentresolver.vercel.app/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md"
  );
  assert.equal(recovery?.authorizationBoundary?.callerMustAuthorizePayment, true);
  assert.equal(recovery?.authorizationBoundary?.agentResolverAuthorizesSpend, false);
  assert.equal(recovery?.authorizationBoundary?.agentResolverReceivesWalletSecrets, false);
  assert.match(recovery?.instruction ?? "", /caller alone authorizes every spend/i);

  const encoded = response.headers.get("payment-required") ?? "";
  assert.ok(encoded.length < 7000, "buyer recovery must keep PAYMENT-REQUIRED comfortably bounded");

  const paidRouteSource = readFileSync("src/lib/createDeterministicPaidRoute.ts", "utf8");
  assert.match(paidRouteSource, /agentresolver: x402BuyerChallengeExtension\(capabilityId\)/);
});
