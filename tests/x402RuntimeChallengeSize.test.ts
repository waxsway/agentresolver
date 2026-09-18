import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/x402-ping/route";
import { x402RuntimeDiscoveryOutput } from "../src/lib/x402RuntimeDiscovery";

test("x402-ping PAYMENT-REQUIRED stays within an interoperability-friendly header budget", async () => {
  const response = await GET(new NextRequest("https://agentresolver.vercel.app/api/x402-ping", {
    method: "GET",
    headers: { "user-agent": "agentresolver-test" }
  }));

  assert.equal(response.status, 402);
  const paymentRequired = response.headers.get("payment-required");
  assert.ok(paymentRequired);
  assert.ok(
    Buffer.byteLength(paymentRequired, "utf8") < 4096,
    `PAYMENT-REQUIRED is ${Buffer.byteLength(paymentRequired, "utf8")} bytes`
  );

  const decoded = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8")) as any;
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.extensions?.bazaar?.info?.output?.example?.pong, true);
  assert.equal(decoded.extensions?.bazaar?.info?.output?.example?.settledDelivery, true);
  assert.equal(decoded.extensions?.bazaar?.info?.output?.example?.next?.recommended?.capabilityId, "x402-payment-preflight");
  assert.equal(decoded.extensions?.agentresolver?.info?.version, 2);
  assert.equal(decoded.extensions?.agentresolver?.info?.method, "GET");
  assert.equal(
    decoded.extensions?.agentresolver?.info?.setup,
    "https://agentresolver.vercel.app/api/x402-client-setup?source=x402-challenge&capabilityId=x402-ping&method=GET"
  );
  assert.equal(decoded.extensions?.agentresolver?.info?.action, "fetch_setup_then_retry");
  assert.equal(decoded.extensions?.agentresolver?.info?.retryHeader, "PAYMENT-SIGNATURE");
  assert.equal(decoded.extensions?.agentresolver?.info?.signerControlledByCaller, true);
  assert.equal(decoded.extensions?.agentresolver?.info?.spendAuthorizationRequired, true);
  assert.equal(decoded.extensions?.agentresolver?.schema?.type, "object");
  assert.ok(decoded.extensions?.agentresolver?.schema?.required?.includes("action"));
  assert.equal(decoded.extensions?.agentresolver?.schema?.required?.includes("clients"), false);
  assert.equal(decoded.extensions?.agentresolver?.info?.clients, undefined);
  assert.ok(JSON.stringify(decoded.extensions?.agentresolver).length < 1200);
  assert.doesNotMatch(
    JSON.stringify(decoded.extensions?.agentresolver),
    /PRIVATE_KEY|seed phrase|0xYourPrivateKey/i
  );
});

test("runtime ping discovery carries the repeat-purchase hint without growing the challenge", () => {
  const output = x402RuntimeDiscoveryOutput("x402-ping") as any;
  assert.equal(output.example.pong, true);
  assert.equal(output.example.settledDelivery, true);
  assert.equal(output.example.next.recommended.capabilityId, "x402-payment-preflight");
  assert.equal(output.schema.type, "object");
  assert.equal(output.schema.additionalProperties, true);
  assert.equal(output.schema.properties, undefined);
  assert.ok(JSON.stringify(output).length < 240);
});

test("runtime discovery keeps preflight decision metadata compact", () => {
  const output = x402RuntimeDiscoveryOutput("x402-payment-preflight") as {
    example: {
      prepaymentDecision: {
        decision: string;
        eligibleForCallerAuthorization: boolean;
      };
    };
  };
  assert.equal(output.example.prepaymentDecision.decision, "eligible");
  assert.equal(output.example.prepaymentDecision.eligibleForCallerAuthorization, true);
  assert.ok(JSON.stringify(output).length < 1200);
});
