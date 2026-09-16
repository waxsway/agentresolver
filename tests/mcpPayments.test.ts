import assert from "node:assert/strict";
import test from "node:test";
import { PAID_CAPABILITY_LIST } from "../src/lib/paidCapabilities";
import { buildStaticMcpPaymentRequirements } from "../src/lib/mcpPayments";

test("direct MCP challenges use local canonical Base USDC requirements", () => {
  for (const product of PAID_CAPABILITY_LIST) {
    const requirements = buildStaticMcpPaymentRequirements(product.id);
    assert.equal(requirements.length, 1);
    assert.equal(requirements[0].scheme, "exact");
    assert.equal(requirements[0].network, "eip155:8453");
    assert.equal(requirements[0].amount, product.atomicAmount);
    assert.equal(
      requirements[0].asset,
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    );
    assert.equal(requirements[0].maxTimeoutSeconds, 300);
    assert.deepEqual(requirements[0].extra, {
      name: "USD Coin",
      version: "2"
    });
  }
});
