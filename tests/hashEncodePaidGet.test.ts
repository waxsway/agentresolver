import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/hash-encode/route";

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

test("hash-encode GET publishes an exact payable query-bound utility", async () => {
  const url = "https://agentresolver.vercel.app/api/hash-encode?operation=sha256&input=agentresolver";
  const response = await withMockPayAiSupported(() =>
    GET(new NextRequest(url, { method: "GET", headers: { "user-agent": "agentresolver-test" } }))
  );

  assert.equal(response.status, 402);
  const body = await response.json() as any;
  assert.equal(body.resource?.url, url);
  assert.equal(body.buyerSetup?.method, "GET");
  assert.match(body.buyerSetup?.setup ?? "", /resumeUrl=/);
  assert.equal(body.extensions?.bazaar?.info?.input?.operation, "sha256");
  assert.equal(body.extensions?.bazaar?.info?.input?.input, "agentresolver");

  const operation = body.extensions?.bazaar?.schema?.properties?.input?.properties?.operation;
  assert.ok(operation?.enum?.includes("sha256"));
  assert.equal(operation?.enum?.includes("hmac-sha256"), false);
  assert.ok(body.accepts?.some((item: any) =>
    item.network === "eip155:8453" &&
    item.amount === "1000" &&
    item.payTo === "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
  ));
});
