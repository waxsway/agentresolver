import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/hash-encode/route";
import { x402RuntimeDiscoveryInput } from "../src/lib/x402RuntimeDiscovery";

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

test("hash-encode GET is an exact $0.001 paid utility", async () => {
  const url = "https://agentresolver.vercel.app/api/hash-encode?operation=sha256&input=agentresolver";
  const response = await withMockPayAiSupported(() =>
    GET(new NextRequest(url, { method: "GET", headers: { "user-agent": "agentresolver-test" } }))
  );

  assert.equal(response.status, 402);
  const body = await response.json() as any;
  assert.equal(body.resource?.url, url);
  assert.equal(body.buyerSetup, undefined);
  assert.equal(body.extensions?.agentresolver?.info?.method, "GET");
  assert.match(body.extensions?.agentresolver?.info?.setup ?? "", /resumeUrl=/);
  assert.ok(body.accepts?.some((item: any) =>
    item.network === "eip155:8453" &&
    item.amount === "1000" &&
    item.payTo === "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
  ));
});

test("hash-encode GET discovery excludes HMAC secrets", () => {
  const input = x402RuntimeDiscoveryInput("hash-encode");
  const operation = input?.schema?.properties?.operation;
  assert.ok(operation?.enum?.includes("sha256"));
  assert.equal((operation?.enum as readonly string[] | undefined)?.includes("hmac-sha256"), false);
  assert.deepEqual(input?.example, { operation: "sha256", input: "agentresolver" });
});


test("hash-encode GET Bazaar metadata follows the actual concrete query", async () => {
  const cases = [
    ["sha512", "agentresolver"],
    ["base64-encode", "hello"],
    ["base64-decode", "aGVsbG8="],
    ["jwt-decode", "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjMifQ.signature"]
  ] as const;

  for (const [operation, input] of cases) {
    const url = new URL("https://agentresolver.vercel.app/api/hash-encode");
    url.searchParams.set("operation", operation);
    url.searchParams.set("input", input);
    const response = await withMockPayAiSupported(() =>
      GET(new NextRequest(url, { method: "GET", headers: { "user-agent": "agentresolver-test" } }))
    );
    assert.equal(response.status, 402);

    const body = await response.clone().json() as any;
    assert.deepEqual(body.extensions?.bazaar?.info?.input?.queryParams, { operation, input });

    const encoded = response.headers.get("payment-required");
    assert.ok(encoded);
    const headerChallenge = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as any;
    assert.deepEqual(
      headerChallenge.extensions?.bazaar?.info?.input?.queryParams,
      { operation, input }
    );
    assert.equal(headerChallenge.resource?.url, url.toString());
  }
});
