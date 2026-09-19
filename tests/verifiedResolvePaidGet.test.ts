import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/verified-resolve/route";

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
          { x402Version: 2, scheme: "exact", network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", extra: { feePayer: "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4" } }
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

test("Verified Resolve GET with goal is a $0.02 payable execution surface", async () => {
  const url = new URL("https://agentresolver.vercel.app/api/verified-resolve");
  url.searchParams.set("goal", "Find and verify a paid web search service");
  url.searchParams.set("maxPriceUsd", "0.05");
  url.searchParams.set("protocol", "x402");
  url.searchParams.set("requireHttps", "true");

  const response = await withMockPayAiSupported(() =>
    GET(new NextRequest(url, { method: "GET", headers: { "user-agent": "agentresolver-test" } }))
  );
  assert.equal(response.status, 402);
  const header = response.headers.get("payment-required");
  assert.ok(header);
  const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as any;
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.accepts?.[0]?.amount, "20000");
  assert.equal(decoded.accepts?.[0]?.network, "eip155:8453");
  assert.match(decoded.resource?.url || "", /verified-resolve/);
  assert.equal(decoded.extensions?.bazaar?.info?.input?.method, "GET");
  assert.equal(decoded.extensions?.bazaar?.info?.input?.queryParams?.goal, "Find and verify a paid web search service");
  assert.equal(decoded.extensions?.bazaar?.info?.input?.queryParams?.maxPriceUsd, 0.05);
  assert.equal(decoded.extensions?.bazaar?.info?.input?.queryParams?.protocol, "x402");
  const querySchema = decoded.extensions?.bazaar?.schema?.properties?.input?.properties?.queryParams;
  assert.deepEqual(querySchema?.required, ["goal"]);
  assert.ok(querySchema?.properties?.providerOrigin);
  assert.ok(querySchema?.properties?.preferredNetwork);
});

test("Verified Resolve empty GET remains discovery-only instead of charging invalid input", async () => {
  const response = await GET(new NextRequest("https://agentresolver.vercel.app/api/verified-resolve", {
    method: "GET",
    headers: { "user-agent": "agentresolver-test" }
  }));
  assert.equal(response.status, 402);
  const body = await response.json() as any;
  assert.equal(body.x402Version, 2);
  assert.equal(body.accepts?.[0]?.amount, "20000");
  assert.match(body.resource?.url || "", /verified-resolve/);
});
