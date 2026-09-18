import assert from "node:assert/strict";
import test from "node:test";
import {
  callerHash,
  classifyIntent,
  configuredPaymentRail,
  extractX402FailureReason,
  logPaidRetryRejection,
  logX402Settlement,
  paymentFailureReasonFromJson,
  referrerHost,
  safeUserAgent,
  shortHash,
  parseX402SettlementHeader,
  paymentAttemptMetadata
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
  assert.equal(configuredPaymentRail("x402-ping", {
    AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1"
  }, "eip155:8453"), "coinbase-cdp");
  assert.equal(configuredPaymentRail("x402-ping", {
    AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1"
  }, "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"), "payai");
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

test("payment attempt metadata distinguishes current and legacy x402 headers without exposing payloads", () => {
  const v2 = Buffer.from(JSON.stringify({ x402Version: 2, payload: { signature: "secret-v2" } }), "utf8").toString("base64");
  const v1 = Buffer.from(JSON.stringify({ x402Version: 1, payload: { signature: "secret-v1" } }), "utf8").toString("base64");

  const current = paymentAttemptMetadata(new Request("https://agentresolver.vercel.app/api/x402-ping", {
    headers: { "payment-signature": v2 }
  }));
  assert.deepEqual(current, {
    hasPaymentAttempt: true,
    hasPaymentSignature: true,
    hasLegacyXPayment: false,
    paymentHeader: "payment-signature",
    paymentX402Version: 2
  });

  const legacy = paymentAttemptMetadata(new Request("https://agentresolver.vercel.app/api/x402-ping", {
    headers: { "x-payment": v1 }
  }));
  assert.deepEqual(legacy, {
    hasPaymentAttempt: true,
    hasPaymentSignature: false,
    hasLegacyXPayment: true,
    paymentHeader: "x-payment",
    paymentX402Version: 1
  });
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

test("failed retry reason extraction finds standard x402 verify reasons but ignores arbitrary fields", async () => {
  assert.equal(
    paymentFailureReasonFromJson({ verifyResponse: { isValid: false, invalidReason: "insufficient_funds" } }),
    "insufficient_funds"
  );
  assert.equal(
    paymentFailureReasonFromJson({ paymentSignature: "super-secret", message: "do not log me" }),
    null
  );
  assert.equal(
    paymentFailureReasonFromJson({ error: "invalid_payload: contract call failed: unable to call contract: execution reverted" }),
    "invalid_payload: contract call failed: unable to call contract: execution reverted"
  );

  const response = new Response(JSON.stringify({
    x402Version: 2,
    verifyResponse: {
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_signature",
      payer: "0x1111111111111111111111111111111111111111"
    }
  }), {
    status: 402,
    headers: { "content-type": "application/json" }
  });
  assert.deepEqual(await extractX402FailureReason(response), {
    reason: "invalid_exact_evm_payload_signature",
    source: "response_body"
  });
});

test("payment-response failure reason takes precedence over response body", async () => {
  const encoded = Buffer.from(JSON.stringify({
    success: false,
    transaction: "",
    network: "eip155:8453",
    payer: "0x1111111111111111111111111111111111111111",
    errorReason: "insufficient_funds"
  }), "utf8").toString("base64");
  const response = new Response(JSON.stringify({ invalidReason: "invalid_payload" }), {
    status: 402,
    headers: { "payment-response": encoded }
  });
  assert.deepEqual(await extractX402FailureReason(response), {
    reason: "insufficient_funds",
    source: "payment_response"
  });
});

test("signed retry rejection telemetry never logs the signature, payer, or raw body", async () => {
  const secretSignature = "signed-payment-payload-secret";
  const payer = "0x1111111111111111111111111111111111111111";
  const req = new Request("https://agentresolver.vercel.app/api/x402-ping", {
    headers: { "payment-signature": secretSignature }
  });
  const response = new Response(JSON.stringify({
    invalidReason: "invalid_exact_evm_payload_recipient_mismatch",
    payer,
    arbitrary: "private body material"
  }), { status: 402 });

  const original = console.log;
  let output = "";
  console.log = (...args: unknown[]) => {
    output += args.map(String).join(" ");
  };
  try {
    await logPaidRetryRejection(req, response, "x402-ping", "request-rejected");
  } finally {
    console.log = original;
  }

  const event = JSON.parse(output);
  assert.equal(event.event, "paid_capability_paid_retry_rejected");
  assert.equal(event.responseStatus, 402);
  assert.equal(event.reason, "invalid_exact_evm_payload_recipient_mismatch");
  assert.equal(event.reasonSource, "response_body");
  assert.equal(output.includes(secretSignature), false);
  assert.equal(output.includes(payer), false);
  assert.equal(output.includes("private body material"), false);
});

test("legacy x-payment retry rejection is measured without logging the signed payload", async () => {
  const legacyPayload = Buffer.from(JSON.stringify({
    x402Version: 1,
    payload: { signature: "legacy-secret-signature" }
  }), "utf8").toString("base64");
  const req = new Request("https://agentresolver.vercel.app/api/x402-ping", {
    headers: { "x-payment": legacyPayload }
  });
  const response = new Response(JSON.stringify({
    invalidReason: "unsupported_x402_version"
  }), { status: 402 });

  const original = console.log;
  let output = "";
  console.log = (...args: unknown[]) => {
    output += args.map(String).join(" ");
  };
  try {
    await logPaidRetryRejection(req, response, "x402-ping", "legacy-request");
  } finally {
    console.log = original;
  }

  const event = JSON.parse(output);
  assert.equal(event.event, "paid_capability_paid_retry_rejected");
  assert.equal(event.paymentHeader, "x-payment");
  assert.equal(event.paymentX402Version, 1);
  assert.equal(event.reason, "unsupported_x402_version");
  assert.equal(output.includes(legacyPayload), false);
  assert.equal(output.includes("legacy-secret-signature"), false);
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


test("Solana settlement telemetry stays attributed to PayAI during scoped CDP canary", () => {
  const transaction = "solana-test-signature";
  const encoded = Buffer.from(JSON.stringify({
    success: true,
    transaction,
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    payer: "ExampleSolanaPayer11111111111111111111111111111",
    amount: "1000"
  }), "utf8").toString("base64");

  const response = new Response("{}", {
    status: 200,
    headers: { "payment-response": encoded }
  });

  const original = console.log;
  let output = "";
  console.log = (...args: unknown[]) => {
    output += args.map(String).join(" ");
  };
  try {
    logX402Settlement(response, "x402-ping", "solana-request", {
      AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1",
      AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES: "x402-ping"
    });
  } finally {
    console.log = original;
  }

  const event = JSON.parse(output);
  assert.equal(event.network, "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
  assert.equal(event.configuredPaymentRail, "payai");
});
