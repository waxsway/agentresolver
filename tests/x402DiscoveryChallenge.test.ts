import assert from "node:assert/strict";
import test from "node:test";
import { x402DiscoveryChallenge } from "../src/lib/x402DiscoveryChallenge";

test("paid discovery challenge exposes Bazaar input/output schemas and dual rails", async () => {
  const response = x402DiscoveryChallenge("x402-payment-preflight");
  assert.equal(response.status, 402);

  const body = await response.json() as any;
  assert.equal(body.x402Version, 2);
  assert.ok(body.extensions?.bazaar?.schema?.properties?.input);
  assert.ok(body.extensions?.bazaar?.schema?.properties?.output);
  assert.equal(body.extensions?.agentresolver?.type, "agentresolver_x402_buyer_setup");
  assert.equal(
    body.extensions?.agentresolver?.url,
    "https://agentresolver.vercel.app/api/x402-client-setup"
  );
  assert.equal(
    body.extensions?.agentresolver?.paymentGuardSkill,
    "https://agentresolver.vercel.app/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md"
  );
  assert.equal(body.extensions?.agentresolver?.paymentAuthorizationRequired, true);
  assert.equal(body.extensions?.agentresolver?.signerControlledByCaller, true);

  assert.ok(body.accepts.some((item: any) => item.network === "eip155:8453"));
  assert.ok(body.accepts.some((item: any) =>
    item.network === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" &&
    item.payTo === "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa"
  ));

  const paymentRequired = response.headers.get("payment-required");
  assert.ok(paymentRequired);
  const decodedHeader = JSON.parse(Buffer.from(paymentRequired!, "base64").toString("utf8"));
  assert.equal(
    decodedHeader.extensions?.agentresolver?.url,
    "https://agentresolver.vercel.app/api/x402-client-setup"
  );
  assert.equal(decodedHeader.extensions?.agentresolver?.paymentAuthorizationRequired, true);
  assert.equal(body.resource.serviceName, "AgentResolver");
  assert.ok(body.resource.description.length <= 240);
  assert.ok(body.resource.tags.length <= 5);
  assert.ok(body.resource.tags.every((tag: string) => tag.length <= 32 && /^[\x20-\x7E]+$/.test(tag)));
  assert.deepEqual(
    body.resource.tags,
    ["x402 preflight", "verify endpoint before paying", "payTo verification", "USDC payment check", "api trust security preflight"]
  );
});
