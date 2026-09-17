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
    Buffer.byteLength(paymentRequired, "utf8") < 8192,
    `PAYMENT-REQUIRED is ${Buffer.byteLength(paymentRequired, "utf8")} bytes`
  );

  const decoded = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8")) as any;
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.extensions?.bazaar?.info?.output?.example?.pong, true);
  assert.equal(decoded.extensions?.bazaar?.info?.output?.example?.settledDelivery, true);
  assert.equal(decoded.extensions?.bazaar?.info?.output?.example?.next, undefined);
});

test("runtime discovery keeps preflight decision metadata compact", () => {
  const output = x402RuntimeDiscoveryOutput("x402-payment-preflight");
  assert.equal(output.example.prepaymentDecision.decision, "eligible");
  assert.equal(output.example.prepaymentDecision.eligibleForCallerAuthorization, true);
  assert.ok(JSON.stringify(output).length < 1200);
});
