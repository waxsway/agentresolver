import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/x402-payment-preflight/route";

test("x402 payment preflight supports a simple paid GET challenge", async () => {
  const target = "https://example.com/api";
  const url = new URL("https://agentresolver.vercel.app/api/x402-payment-preflight");
  url.searchParams.set("url", target);
  url.searchParams.set("method", "GET");
  url.searchParams.set("maxPriceUsd", "0.01");

  const response = await GET(new NextRequest(url, {
    method: "GET",
    headers: { "user-agent": "agentresolver-test" }
  }));

  assert.equal(response.status, 402);
  const paymentRequired = response.headers.get("payment-required");
  assert.ok(paymentRequired);
  assert.ok(Buffer.byteLength(paymentRequired, "utf8") < 8192);

  const decoded = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8")) as any;
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.accepts?.length, 2);
  assert.equal(decoded.accepts?.[0]?.network, "eip155:8453");
  assert.match(decoded.resource?.url || "", /x402-payment-preflight/);
  assert.equal(
    decoded.extensions?.bazaar?.info?.output?.example?.prepaymentDecision?.decision,
    "eligible"
  );
});
