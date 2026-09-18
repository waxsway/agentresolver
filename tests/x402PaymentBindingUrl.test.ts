import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getPing } from "../src/app/api/x402-ping/route";
import { normalizeX402PaymentRequest } from "../src/lib/createDeterministicPaidRoute";
import { stripAgentResolverInfrastructureQueryParams } from "../src/lib/x402BuyerSetup";

test("infrastructure query sanitizer preserves buyer input and strips only Vercel keys", () => {
  assert.equal(
    stripAgentResolverInfrastructureQueryParams(
      "https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check&_vercel_share=secret&_vercel_protection_bypass=token"
    ),
    "https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check"
  );
  assert.equal(
    stripAgentResolverInfrastructureQueryParams(
      "https://agentresolver.vercel.app/api/payment-guard?url=https%3A%2F%2Fexample.com%2Fpaid&method=GET"
    ),
    "https://agentresolver.vercel.app/api/payment-guard?url=https%3A%2F%2Fexample.com%2Fpaid&method=GET"
  );
});

test("payment request normalization preserves POST body, method and meaningful query", async () => {
  const request = new NextRequest(
    "https://agentresolver.vercel.app/api/x402-payment-preflight?trace=buyer&_vercel_share=secret",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-buyer-test": "1"
      },
      body: JSON.stringify({ url: "https://example.com/paid", method: "GET" })
    }
  );

  const normalized = normalizeX402PaymentRequest(request);
  assert.notEqual(normalized, request);
  assert.equal(
    normalized.url,
    "https://agentresolver.vercel.app/api/x402-payment-preflight?trace=buyer"
  );
  assert.equal(normalized.method, "POST");
  assert.equal(normalized.headers.get("x-buyer-test"), "1");
  assert.deepEqual(await normalized.json(), {
    url: "https://example.com/paid",
    method: "GET"
  });
});

test("x402 challenge resource binding excludes Vercel-only query keys", async () => {
  const response = await getPing(new NextRequest(
    "https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check&_vercel_share=secret",
    {
      method: "GET",
      headers: { "user-agent": "agentresolver-test" }
    }
  ));

  assert.equal(response.status, 402);
  const paymentRequired = response.headers.get("payment-required");
  assert.ok(paymentRequired);
  const decoded = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8")) as any;

  assert.equal(
    decoded.resource?.url,
    "https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check"
  );
  assert.equal(decoded.resource?.url.includes("_vercel_"), false);
  assert.equal(decoded.extensions?.agentresolver?.info?.method, "GET");

  const extensionSetup = decoded.extensions?.agentresolver?.info?.setup;
  assert.ok(extensionSetup);
  assert.equal(extensionSetup.includes("_vercel_"), false);
  assert.equal(
    extensionSetup.includes(
      encodeURIComponent("https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check")
    ),
    true
  );

  const buyerSetup = response.headers.get("x-agentresolver-buyer-setup");
  assert.ok(buyerSetup);
  assert.equal(buyerSetup.includes("_vercel_"), false);
  assert.equal(
    buyerSetup.includes(
      encodeURIComponent("https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check")
    ),
    true
  );
});
