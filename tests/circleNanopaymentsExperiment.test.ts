import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Circle Gateway nanopayments are opt-in and additive", () => {
  const source = readFileSync("src/lib/createDeterministicPaidRoute.ts", "utf8");

  assert.match(source, /AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED === "true"/);
  assert.match(source, /new BatchFacilitatorClient\(\)/);
  assert.match(source, /new GatewayEvmScheme\(\)/);
  assert.match(source, /new HTTPFacilitatorClient/);
  assert.match(source, /X402_SOLANA_NETWORK/);
  assert.doesNotMatch(source, /PRIVATE_KEY|privateKey|seed phrase/i);
});

test("Circle batching dependency is pinned", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.dependencies["@circle-fin/x402-batching"], "3.5.0");
});
