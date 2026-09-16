import test from "node:test";
import assert from "node:assert/strict";
import { assessX402Payment } from "../src/lib/httpInspect";

const target = "https://merchant.example/api/pay";
const challenge = {
  x402Version: 2,
  resource: { url: target },
  accepts: [{
    scheme: "exact",
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x1111111111111111111111111111111111111111",
    resource: target,
    amount: "5000"
  }]
};

test("assessX402Payment verifies a bounded Base USDC quote", () => {
  const encoded = Buffer.from(JSON.stringify(challenge), "utf8").toString("base64");
  const result = assessX402Payment(402, target, encoded, {
    maxPriceUsd: 0.01,
    expectedNetwork: "eip155:8453",
    expectedPayTo: "0x1111111111111111111111111111111111111111"
  });

  assert.equal(result.detected, true);
  assert.equal(result.parseable, true);
  assert.equal(result.version, 2);
  assert.equal(result.amountUsd, 0.005);
  assert.equal(result.score, 100);
  assert.equal(result.verdict, "strong");
});

test("assessX402Payment flags a quote above caller max price", () => {
  const encoded = Buffer.from(JSON.stringify(challenge), "utf8").toString("base64");
  const result = assessX402Payment(402, target, encoded, { maxPriceUsd: 0.001 });
  const priceCheck = result.checks.find((check) => check.id === "max_price");

  assert.equal(priceCheck?.passed, false);
  assert.ok((result.score ?? 100) < 100);
});

test("assessX402Payment does not invent x402 support", () => {
  const result = assessX402Payment(200, target, null);
  assert.equal(result.detected, false);
  assert.equal(result.score, null);
  assert.equal(result.verdict, "not-detected");
});


test("assessX402Payment prices and validates Solana USDC quotes", () => {
  const solanaPayTo = "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa";
  const solanaChallenge = {
    x402Version: 2,
    resource: { url: target },
    accepts: [{
      scheme: "exact",
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      payTo: solanaPayTo,
      resource: target,
      amount: "5000",
      extra: { feePayer: "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4" }
    }]
  };
  const encoded = Buffer.from(JSON.stringify(solanaChallenge), "utf8").toString("base64");
  const result = assessX402Payment(402, target, encoded, {
    maxPriceUsd: 0.01,
    expectedNetwork: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    expectedPayTo: solanaPayTo
  });

  assert.equal(result.amountUsd, 0.005);
  assert.equal(result.score, 100);
  assert.equal(result.verdict, "strong");
});
