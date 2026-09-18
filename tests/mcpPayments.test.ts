import assert from "node:assert/strict";
import test from "node:test";
import { PAID_CAPABILITY_LIST } from "../src/lib/paidCapabilities";
import {
  buildStaticMcpPaymentRequirements,
  mcpPaymentResourceUrl,
  withX402BuyerSetupHint
} from "../src/lib/mcpPayments";
import { X402_BUYER_SETUP_URL } from "../src/lib/x402BuyerSetup";

test("MCP Guard resource identities bind payment to the exact tool", () => {
  assert.equal(mcpPaymentResourceUrl("payment_guard"), "mcp://tool/payment_guard");
  assert.equal(
    mcpPaymentResourceUrl("x402_payment_preflight"),
    "mcp://tool/x402_payment_preflight"
  );
  assert.equal(mcpPaymentResourceUrl(), "https://agentresolver.vercel.app/mcp");
  assert.throws(() => mcpPaymentResourceUrl("bad/tool"), /invalid/i);
});

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
      feePayer: "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4"
    });
  }
});

test("MCP buyer setup hint preserves the standard PaymentRequired structured content", () => {
  const structuredContent = {
    x402Version: 2,
    accepts: buildStaticMcpPaymentRequirements("x402-payment-preflight"),
    resource: {
      url: "https://agentresolver.vercel.app/mcp",
      description: "test",
      mimeType: "application/json"
    }
  };
  const result = withX402BuyerSetupHint({
    isError: true,
    structuredContent,
    content: [{ type: "text", text: JSON.stringify(structuredContent) }]
  }, "x402-payment-preflight");

  assert.equal(result.structuredContent, structuredContent);
  assert.equal(result.content.length, 2);
  assert.match(result.content[1].text, /agentresolver_x402_buyer_setup/);
  assert.match(result.content[1].text, new RegExp(X402_BUYER_SETUP_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("MCP buyer setup hint is not added to successful paid output", () => {
  const result = withX402BuyerSetupHint({
    isError: false,
    structuredContent: { ok: true },
    content: [{ type: "text", text: "paid result" }]
  }, "x402-payment-preflight");

  assert.deepEqual(result.content, [{ type: "text", text: "paid result" }]);
});
