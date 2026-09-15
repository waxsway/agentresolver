import test from "node:test";
import assert from "node:assert/strict";
import {
  marketplaceMethod,
  parseX402PaymentOptions
} from "../src/lib/x402HttpProbe";

test("marketplace probe honors safe advertised HTTP methods and defaults to GET", () => {
  assert.equal(marketplaceMethod({ type: "http", method: "POST" }), "POST");
  assert.equal(marketplaceMethod({ method: "patch" }), "PATCH");
  assert.equal(marketplaceMethod({ method: "HEAD" }), "HEAD");
  assert.equal(marketplaceMethod({ method: "TRACE" }), "GET");
  assert.equal(marketplaceMethod(null), "GET");
});

test("parses x402 v2 payment options from a JSON 402 body", () => {
  const options = parseX402PaymentOptions(JSON.stringify({
    x402Version: 2,
    accepts: [{
      scheme: "exact",
      network: "eip155:8453",
      amount: "5000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x1111111111111111111111111111111111111111"
    }]
  }), null);

  assert.deepEqual(options, [{
    scheme: "exact",
    network: "eip155:8453",
    amount: "5000",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x1111111111111111111111111111111111111111"
  }]);
});

test("parses legacy maxAmountRequired and base64 PAYMENT-REQUIRED headers", () => {
  const payload = {
    accepts: [{
      scheme: "exact",
      network: "base",
      maxAmountRequired: "1000",
      asset: "USDC",
      payTo: "0x2222222222222222222222222222222222222222"
    }]
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

  const options = parseX402PaymentOptions("", encoded);
  assert.equal(options[0]?.amount, "1000");
  assert.equal(options[0]?.network, "base");
  assert.equal(options[0]?.scheme, "exact");
});
