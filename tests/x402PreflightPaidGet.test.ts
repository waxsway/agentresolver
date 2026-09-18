import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/x402-payment-preflight/route";
import { GET as GUARD_GET, POST as GUARD_POST } from "../src/app/api/payment-guard/route";

async function withMockPayAiSupported<T>(run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url === "https://facilitator.payai.network/supported") {
      return new Response(JSON.stringify({
        kinds: [
          { x402Version: 2, scheme: "exact", network: "eip155:8453", extra: {} },
          {
            x402Version: 2,
            scheme: "exact",
            network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            extra: { feePayer: "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4" }
          }
        ],
        extensions: ["bazaar"],
        signers: {}
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    return originalFetch(input, init);
  };

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("x402 payment preflight supports a simple paid GET challenge", async () => {
  const target = "https://example.com/api";
  const url = new URL("https://agentresolver.vercel.app/api/x402-payment-preflight");
  url.searchParams.set("url", target);
  url.searchParams.set("method", "GET");
  url.searchParams.set("maxPriceUsd", "0.01");

  const response = await withMockPayAiSupported(() =>
    GET(new NextRequest(url, {
      method: "GET",
      headers: { "user-agent": "agentresolver-test" }
    }))
  );

  assert.equal(response.status, 402);
  assert.equal(
    response.headers.get("x-agentresolver-payment-guard"),
    "https://agentresolver.vercel.app/api/payment-guard"
  );
  assert.match(response.headers.get("access-control-expose-headers") || "", /x-agentresolver-payment-guard/i);
  const paymentRequired = response.headers.get("payment-required");
  assert.ok(paymentRequired);
  assert.ok(Buffer.byteLength(paymentRequired, "utf8") < 8192);

  const decoded = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8")) as any;
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.accepts?.length, 2);
  assert.equal(decoded.accepts?.[0]?.network, "eip155:8453");
  assert.match(decoded.resource?.url || "", /x402-payment-preflight/);
  assert.match(decoded.resource?.description || "", /payment requirements before wallet signing/i);
  assert.match(decoded.resource?.description || "", /payTo/i);
  assert.equal(decoded.resource?.serviceName, "AgentResolver Guard");
  assert.deepEqual(decoded.resource?.tags, [
    "x402",
    "preflight",
    "payment-safety",
    "agent-payments"
  ]);
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

  const response = await withMockPayAiSupported(() =>
    GUARD_GET(new NextRequest(url, {
      method: "GET",
      headers: { "user-agent": "agentresolver-test" }
    }))
  );

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


test("Guard rejects missing required input before issuing a payment challenge", async () => {
  for (const [path, handler] of [
    ["/api/x402-payment-preflight", GET],
    ["/api/payment-guard", GUARD_GET]
  ] as const) {
    const response = await handler(new NextRequest(`https://agentresolver.vercel.app${path}`, {
      method: "GET",
      headers: { "user-agent": "agentresolver-test" }
    }));

    assert.equal(response.status, 400);
    assert.equal(response.headers.get("payment-required"), null);
    assert.equal(response.headers.get("x-agentresolver-buyer-setup"), "https://agentresolver.vercel.app/api/x402-client-setup");
    assert.equal(response.headers.get("x-agentresolver-payment-guard"), "https://agentresolver.vercel.app/api/payment-guard");
    assert.match(response.headers.get("access-control-expose-headers") || "", /x-agentresolver-buyer-setup/i);
    const body = await response.json() as any;
    assert.match(body.message, /url is required before payment/i);
    assert.equal(body.paymentRequired, false);
    assert.equal(body.spendingAuthorized, false);
    assert.equal(body.requiredInput?.url, "https://target.example/api");
    assert.match(body.retry?.buyerSetup || "", /x402-client-setup/);
  }
});


test("Guard rejects missing POST input before issuing a payment challenge", async () => {
  for (const [path, handler] of [
    ["/api/x402-payment-preflight", POST],
    ["/api/payment-guard", GUARD_POST]
  ] as const) {
    const response = await handler(new NextRequest(`https://agentresolver.vercel.app${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "agentresolver-test" },
      body: JSON.stringify({})
    }));

    assert.equal(response.status, 400);
    assert.equal(response.headers.get("payment-required"), null);
    assert.equal(response.headers.get("x-agentresolver-buyer-setup"), "https://agentresolver.vercel.app/api/x402-client-setup");
    assert.equal(response.headers.get("x-agentresolver-payment-guard"), "https://agentresolver.vercel.app/api/payment-guard");
    assert.match(response.headers.get("access-control-expose-headers") || "", /x-agentresolver-buyer-setup/i);
    const body = await response.json() as any;
    assert.match(body.message, /url is required before payment/i);
    assert.equal(body.paymentRequired, false);
    assert.equal(body.spendingAuthorized, false);
    assert.equal(body.requiredInput?.url, "https://target.example/api");
    assert.match(body.retry?.buyerSetup || "", /x402-client-setup/);
  }
});
