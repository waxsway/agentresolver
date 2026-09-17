import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/x402-payment-preflight/route";
import { GET as GUARD_GET } from "../src/app/api/payment-guard/route";

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
  assert.equal(decoded.extensions?.bazaar?.info?.input?.method, "GET");
  assert.equal(decoded.extensions?.bazaar?.info?.input?.queryParams?.url, "https://example.com/api");
  assert.equal(decoded.extensions?.bazaar?.info?.input?.queryParams?.method, "GET");
  assert.equal(decoded.extensions?.bazaar?.info?.input?.queryParams?.maxPriceUsd, 0.01);

  const querySchema =
    decoded.extensions?.bazaar?.schema?.properties?.input?.properties?.queryParams;
  assert.ok(querySchema?.properties?.url);
  assert.ok(querySchema?.properties?.maxPriceUsd);
  assert.ok(querySchema?.properties?.expectedPayTo);
  assert.ok(querySchema?.properties?.expectedNetwork);
  assert.ok(querySchema?.properties?.method);
  assert.ok(querySchema?.properties?.allowUnpaidPostProbe);
  assert.deepEqual(querySchema?.required, ["url"]);
});

test("AgentResolver Guard alias publishes the same compact GET query contract", async () => {
  const url = new URL("https://agentresolver.vercel.app/api/payment-guard");
  url.searchParams.set("url", "https://example.com/api");
  url.searchParams.set("method", "GET");
  url.searchParams.set("maxPriceUsd", "0.01");

  const response = await GUARD_GET(new NextRequest(url, {
    method: "GET",
    headers: { "user-agent": "agentresolver-test" }
  }));

  assert.equal(response.status, 402);
  const paymentRequired = response.headers.get("payment-required");
  assert.ok(paymentRequired);
  assert.ok(
    Buffer.byteLength(paymentRequired, "utf8") < 8192,
    `Guard PAYMENT-REQUIRED is ${Buffer.byteLength(paymentRequired, "utf8")} bytes`
  );

  const decoded = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8")) as any;
  assert.match(decoded.resource?.url || "", /\/api\/payment-guard/);
  assert.equal(decoded.extensions?.bazaar?.info?.input?.method, "GET");
  assert.equal(decoded.extensions?.bazaar?.info?.input?.queryParams?.url, "https://example.com/api");
  assert.equal(
    decoded.extensions?.bazaar?.info?.output?.example?.prepaymentDecision?.decision,
    "eligible"
  );
});
