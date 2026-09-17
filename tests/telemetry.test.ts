import assert from "node:assert/strict";
import test from "node:test";
import {
  callerHash,
  classifyIntent,
  configuredPaymentRail,
  logX402Settlement,
  referrerHost,
  safeUserAgent,
  shortHash,
  parseX402SettlementHeader
} from "../src/lib/telemetry";

test("shortHash is stable and does not expose the original value", () => {
  const value = "203.0.113.10";
  const first = shortHash(value);
  assert.equal(first, shortHash(value));
  assert.equal(first.length, 16);
  assert.notEqual(first, value);
});

test("classifyIntent returns coarse demand categories", () => {
  assert.deepEqual(classifyIntent("Find a browser tool to scrape a product page"), ["web", "search", "commerce"]);
  assert.deepEqual(classifyIntent("something unusual"), ["other"]);
});

test("configured payment rail keeps CDP bounded to its capability scope", () => {
  assert.equal(configuredPaymentRail("x402-ping", {}), "payai");
  assert.equal(configuredPaymentRail("x402-ping", {
    AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1"
  }), "coinbase-cdp");
  assert.equal(configuredPaymentRail("x402-payment-preflight", {
    AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1"
  }), "payai");
  assert.equal(configuredPaymentRail("x402-payment-preflight", {
    AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1",
    AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES: "x402-ping,x402-payment-preflight"
  }), "coinbase-cdp");
});

test("configured payment rail reports additive Circle configuration without hiding CDP", () => {
  assert.equal(configuredPaymentRail("x402-ping", {
    AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED: "1"
  }), "payai+circle-gateway");
  assert.equal(configuredPaymentRail("x402-ping", {
    AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1",
    AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED: "1"
  }), "coinbase-cdp+circle-gateway");
});

test("request telemetry uses hashed caller identity and bounded metadata", () => {
  const req = new Request("https://agentresolver.vercel.app/mcp", {
    headers: {
      "x-forwarded-for": "203.0.113.10, 198.51.100.1",
      "user-agent": "ExampleAgent/1.0",
      referer: "https://example.com/path?secret=1"
    }
  });

  assert.equal(callerHash(req), shortHash("203.0.113.10"));
  assert.equal(safeUserAgent(req), "ExampleAgent/1.0");
  assert.equal(referrerHost(req), "example.com");
});

test("x402 settlement parsing requires explicit success receipt data", () => {
  const payload = {
    success: true,
    transaction: "0xabc123",
    network: "eip155:8453",
    payer: "0xdef456",
    amount: "1000"
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  assert.deepEqual(parseX402SettlementHeader(encoded), {
    success: true,
    transaction: "0xabc123",
    network: "eip155:8453",
    payer: "0xdef456",
    amount: "1000",
    errorReason: null
  });
  assert.equal(parseX402SettlementHeader(null), null);
  assert.equal(parseX402SettlementHeader("not-base64-json"), null);
});

test("successful settlement telemetry exposes public transaction reference but never raw payer", () => {
  const transaction = `0x${"ab".repeat(32)}`;
  const payer = "0x1111111111111111111111111111111111111111";
  const encoded = Buffer.from(JSON.stringify({
    success: true,
    transaction,
    network: "eip155:8453",
    payer,
    amount: "1000"
  }), "utf8").toString("base64");

  const response = new Response("{}", {
    status: 200,
    headers: {
      "payment-response": encoded,
      "x-agentresolver-execution-id": "11111111-1111-4111-8111-111111111111",
      "x-agentresolver-response-sha256": "c".repeat(64),
      "x-agentresolver-deployment": "d".repeat(40)
    }
  });

  const original = console.log;
  let output = "";
  console.log = (...args: unknown[]) => {
    output += args.map(String).join(" ");
  };
  try {
    logX402Settlement(response, "x402-ping", "request-1", {
      AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1",
      AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES: "x402-ping"
    });
  } finally {
    console.log = original;
  }

  const event = JSON.parse(output);
  assert.equal(event.event, "paid_capability_settled");
  assert.equal(event.configuredPaymentRail, "coinbase-cdp");
  assert.equal(event.transactionReference, transaction);
  assert.equal(event.transactionFingerprint, shortHash(transaction));
  assert.equal(event.payerHash, shortHash(payer));
  assert.equal(output.includes(payer), false);
});
