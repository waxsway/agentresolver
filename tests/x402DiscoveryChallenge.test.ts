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

  assert.ok(body.accepts.some((item: any) => item.network === "eip155:8453"));
  assert.ok(body.accepts.some((item: any) =>
    item.network === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" &&
    item.payTo === "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa"
  ));

  assert.ok(response.headers.get("payment-required"));
});
