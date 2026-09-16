import assert from "node:assert/strict";
import test from "node:test";
import { PAID_CAPABILITY_LIST } from "../src/lib/paidCapabilities";
import { buildStaticMcpPaymentRequirements } from "../src/lib/mcpPayments";

test("direct MCP challenges advertise Base and Solana USDC requirements", () => {
  for (const product of PAID_CAPABILITY_LIST) {
    const requirements = buildStaticMcpPaymentRequirements(product.id);
    assert.equal(requirements.length, 2);

    const base = requirements.find((item) => item.network === "eip155:8453");
    assert.ok(base);
    assert.equal(base.scheme, "exact");
    assert.equal(base.amount, product.atomicAmount);
    assert.equal(base.asset, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    assert.equal(base.maxTimeoutSeconds, 300);
    assert.deepEqual(base.extra, { name: "USD Coin", version: "2" });

    const solana = requirements.find(
      (item) => item.network === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
    );
    assert.ok(solana);
    assert.equal(solana.scheme, "exact");
    assert.equal(solana.amount, product.atomicAmount);
    assert.equal(solana.asset, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    assert.equal(solana.payTo, "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa");
    assert.equal(solana.maxTimeoutSeconds, 300);
    assert.deepEqual(solana.extra, {
      feePayer: "CjNFTjvBhbJJd2B5ePPMHRLx1ELZpa8dwQgGL727eKww"
    });
  }
});
