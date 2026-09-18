import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/x402-ping/route";
import { x402DiscoveryChallenge } from "../src/lib/x402DiscoveryChallenge";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

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
          {
            x402Version: 2,
            scheme: "exact",
            network: "eip155:8453",
            extra: {}
          },
          {
            x402Version: 2,
            scheme: "exact",
            network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            extra: {
              feePayer: "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4"
            }
          }
        ],
        extensions: ["bazaar"],
        signers: {}
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    return originalFetch(input, init);
  };

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("x402-ping exposes a payable GET while preserving POST", async () => {
  const getResponse = await withMockPayAiSupported(() =>
    GET(new NextRequest("https://agentresolver.vercel.app/api/x402-ping", {
      method: "GET",
      headers: { "user-agent": "agentresolver-test" }
    }))
  );
  assert.equal(getResponse.status, 402);
  assert.equal(getResponse.headers.get("access-control-allow-origin"), "*");
  const getPaymentRequired = getResponse.headers.get("payment-required");
  assert.ok(getPaymentRequired);
  const getBody = await getResponse.clone().json() as any;
  assert.equal(getBody.x402Version, 2);
  assert.ok(Array.isArray(getBody.accepts));
  assert.equal((getBody as any).buyerSetup, undefined);
  assert.deepEqual(
    Object.keys(getBody).sort(),
    ["accepts", "error", "extensions", "resource", "x402Version"].sort()
  );
  assert.equal(
    getResponse.headers.get("x-agentresolver-buyer-setup"),
    "https://agentresolver.vercel.app/api/x402-client-setup?source=x402-challenge&capabilityId=x402-ping&method=GET"
  );
  assert.ok(getBody.accepts.some((item: any) =>
    item.network === "eip155:8453" &&
    item.amount === "1000" &&
    item.payTo === "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
  ));
  const decodedHeader = JSON.parse(Buffer.from(getPaymentRequired!, "base64").toString("utf8"));
  assert.equal(decodedHeader.error, "Payment required");
  assert.equal(getBody.error, "Payment required");
  assert.deepEqual(getBody, decodedHeader);
  assert.deepEqual(getBody.resource, decodedHeader.resource);
  assert.deepEqual(getBody.accepts, decodedHeader.accepts);
  assert.deepEqual(getBody.extensions, decodedHeader.extensions);
  assert.equal(decodedHeader.resource?.serviceName, "AgentResolver");
  assert.equal(decodedHeader.extensions?.agentresolver, undefined);
  assert.deepEqual(decodedHeader.resource?.tags, [
    "x402",
    "settlement-test",
    "payment-canary",
    "agent-payments"
  ]);

  const bazaarInput = getBody.extensions?.bazaar?.info?.input;
  assert.equal(bazaarInput?.type, "http");
  assert.equal(bazaarInput?.method, "GET");
  assert.equal(bazaarInput?.bodyType, undefined);
  assert.equal(bazaarInput?.body, undefined);
  assert.equal(bazaarInput?.queryParams?.echo, "hello");
  const querySchema = getBody.extensions?.bazaar?.schema?.properties?.input?.properties?.queryParams;
  assert.equal(querySchema?.properties?.echo?.type, "string");
  assert.equal(querySchema?.properties?.echo?.maxLength, 256);
  assert.equal(querySchema?.required, undefined);
  assert.ok(Buffer.byteLength(getPaymentRequired!, "utf8") < 8192);
  assert.equal(
    getResponse.headers.get("x-agentresolver-history"),
    "https://agentresolver.vercel.app/.well-known/agentresolver-reputation.json"
  );
  assert.match(
    getResponse.headers.get("access-control-expose-headers") || "",
    /x-agentresolver-history/
  );

  const postResponse = await POST(new NextRequest("https://agentresolver.vercel.app/api/x402-ping", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "agentresolver-test"
    },
    body: JSON.stringify({ echo: "hello" })
  }));
  assert.equal(postResponse.status, 402);
  assert.equal(postResponse.headers.get("access-control-allow-origin"), "*");
  assert.ok(postResponse.headers.get("payment-required"));
  const postBody = await postResponse.json() as any;
  assert.equal(postBody.x402Version, 2);
  assert.ok(Array.isArray(postBody.accepts));
  assert.equal((postBody as any).buyerSetup, undefined);
  assert.equal(postBody.extensions?.agentresolver, undefined);
  assert.deepEqual(
    Object.keys(postBody).sort(),
    ["accepts", "error", "extensions", "resource", "x402Version"].sort()
  );
  assert.equal(
    postResponse.headers.get("x-agentresolver-buyer-setup"),
    "https://agentresolver.vercel.app/api/x402-client-setup?source=x402-challenge&capabilityId=x402-ping&method=POST"
  );
});

test("x402 discovery challenge uses standard extensions and body-visible buyer setup", async () => {
  const response = x402DiscoveryChallenge("x402-ping");
  const body = await response.json() as any;
  const paymentRequired = response.headers.get("payment-required");
  assert.ok(paymentRequired);

  const decoded = JSON.parse(Buffer.from(paymentRequired!, "base64").toString("utf8"));
  assert.deepEqual(body, decoded);
  assert.match(body.error || "", /https:\/\/agentresolver\.vercel\.app\/api\/x402-client-setup/);
  assert.equal(body.extensions?.agentresolver, undefined);
  assert.ok(body.extensions?.bazaar?.info);
  assert.ok(body.extensions?.bazaar?.schema);
});

test("generated machine surfaces prefer GET for the settlement canary", () => {
  const manifest = readJson("public/.well-known/x402");
  const jsonManifest = readJson("public/.well-known/x402.json");
  const capabilities = readJson("public/capabilities.json");
  const integrations = readJson("public/integrations.json");
  const openapi = readJson("public/openapi.json");

  assert.deepEqual(jsonManifest, manifest);
  assert.equal(manifest.category, "Developer Tools");
  assert.ok(manifest.tags.includes("payment-canary"));
  assert.equal(manifest.owner_url, "https://agentresolver.vercel.app");
  assert.equal(manifest.owner_contact, "https://github.com/waxsway/agentresolver");
  assert.equal(manifest.openapi, "https://agentresolver.vercel.app/openapi.json");
  assert.equal(manifest.mcp, "https://agentresolver.vercel.app/mcp");
  assert.equal(manifest.facilitator.default, "https://facilitator.payai.network");
  assert.equal(manifest.payment_protocols[0], "x402");
  assert.match(manifest.generated_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(manifest.instructions || "", /verified-resolve/);
  assert.match(manifest.instructions || "", /batch-verified-resolve/);
  const canaryService = manifest.services.find((item: any) => item.id === "x402-ping");
  assert.equal(canaryService.endpoint, "https://agentresolver.vercel.app/api/x402-ping");
  assert.equal(canaryService.method, "GET");
  assert.deepEqual(canaryService.methods, ["GET", "POST"]);
  assert.equal(canaryService.price_usdc, "0.001");
  assert.equal(canaryService.network_id, "eip155:8453");
  assert.equal(canaryService.asset, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  assert.equal(canaryService.owner_url, "https://agentresolver.vercel.app");
  assert.ok(manifest.services.some((item: any) =>
    item.id === "x402-payment-preflight" &&
    item.endpoint === "https://agentresolver.vercel.app/api/x402-payment-preflight"
  ));
  assert.ok(manifest.resources.some((item: any) => item.resource === "GET /api/x402-ping"));
  assert.ok(manifest.resources.some((item: any) => item.resource === "POST /api/x402-ping"));
  assert.ok(manifest.resources.some((item: any) => item.resource === "POST /api/x402-payment-preflight"));
  const getManifest = manifest.resources.find((item: any) => item.resource === "GET /api/x402-ping");
  const postManifest = manifest.resources.find((item: any) => item.resource === "POST /api/x402-ping");
  assert.match(getManifest?.description || "", /settlement test/i);
  assert.ok(getManifest?.outputSchema?.required?.includes("next"));
  assert.equal(
    getManifest?.outputSchema?.properties?.next?.properties?.preflight?.properties?.capabilityId?.const,
    "x402-payment-preflight"
  );
  assert.equal(
    getManifest?.outputSchema?.properties?.next?.properties?.single?.properties?.capabilityId?.const,
    "verified-resolve"
  );
  assert.equal(
    postManifest?.outputSchema?.properties?.next?.properties?.batch?.properties?.capabilityId?.const,
    "batch-verified-resolve"
  );

  const capability = capabilities.capabilities.find((item: any) => item.id === "x402-ping");
  assert.equal(capability.method, "GET");
  assert.deepEqual(capability.methods, ["GET", "POST"]);
  assert.equal(capability.preferredMethod, "GET");

  const integration = integrations.paidActions.find((item: any) => item.id === "x402-ping");
  assert.equal(integration.method, "GET");
  assert.equal(integration.bodyExample, undefined);

  const pathItem = openapi.paths["/api/x402-ping"];
  assert.ok(pathItem.get);
  assert.ok(pathItem.post);
  assert.equal(pathItem.get.requestBody, undefined);
  const echoParam = pathItem.get.parameters?.find((item: any) => item.name === "echo");
  assert.equal(echoParam?.in, "query");
  assert.equal(echoParam?.required, false);
  assert.equal(echoParam?.schema?.maxLength, 256);
  assert.equal(pathItem.get["x-payment-info"].priceUsd, 0.001);
  assert.match(pathItem.get.summary || "", /settlement test/i);
  assert.match(pathItem.get.description || "", /wallet/i);
  assert.match(pathItem.get.description || "", /facilitator/i);
  assert.equal(openapi.info.version, "0.1.9");
  assert.match(openapi.info["x-guidance"] || "", /verified-resolve/);
  assert.match(openapi.info["x-guidance"] || "", /batch-verified-resolve/);

  const getOutputSchema = pathItem.get.responses?.["200"]?.content?.["application/json"]?.schema;
  const postOutputSchema = pathItem.post.responses?.["200"]?.content?.["application/json"]?.schema;
  assert.ok(getOutputSchema?.required?.includes("next"));
  assert.ok(postOutputSchema?.required?.includes("next"));
  assert.deepEqual(getOutputSchema?.properties?.next?.required, ["catalogUrl", "recommended", "preflight", "settlementVerify", "single", "batch"]);
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.recommended?.properties?.capabilityId?.const,
    "hash-encode"
  );
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.recommended?.properties?.repeatUse?.const,
    "when_a_deterministic_hash_or_encoding_transform_is_needed"
  );
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.recommended?.properties?.paymentAuthorization?.const,
    "separate_caller_authorization_required"
  );
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.preflight?.properties?.capabilityId?.const,
    "x402-payment-preflight"
  );
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.preflight?.properties?.priceUsd?.const,
    0.001
  );
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.preflight?.properties?.method?.const,
    "GET"
  );
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.settlementVerify?.properties?.capabilityId?.const,
    "x402-settlement-verify"
  );
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.settlementVerify?.properties?.method?.const,
    "GET"
  );
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.settlementVerify?.properties?.paymentAuthorization?.const,
    "separate_caller_authorization_required"
  );
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.single?.properties?.capabilityId?.const,
    "verified-resolve"
  );
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.single?.properties?.priceUsd?.const,
    0.02
  );
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.batch?.properties?.capabilityId?.const,
    "batch-verified-resolve"
  );
  assert.equal(
    getOutputSchema?.properties?.next?.properties?.batch?.properties?.priceUsd?.const,
    0.05
  );
});


test("x402-ping advertises a strict paid delivery output contract", async () => {
  const response = x402DiscoveryChallenge("x402-ping");
  const body = await response.json() as any;
  const output = body.extensions?.bazaar?.info?.output;
  const schemaOutput = body.extensions?.bazaar?.schema?.properties?.output;

  assert.equal(output?.type, "json");
  assert.equal(output?.example?.pong, true);
  assert.equal(output?.example?.settledDelivery, true);
  assert.equal(output?.example?.echo, null);
  assert.equal(output?.example?.next?.recommended?.capabilityId, "hash-encode");
  assert.equal(output?.example?.next?.recommended?.priceUsd, 0.001);
  assert.equal(output?.example?.next?.recommended?.repeatUse, "when_a_deterministic_hash_or_encoding_transform_is_needed");
  assert.equal(
    output?.example?.next?.recommended?.paymentAuthorization,
    "separate_caller_authorization_required"
  );
  assert.match(output?.example?.next?.recommended?.reason || "", /useful deterministic \$0\.001 GET/i);
  assert.equal(output?.example?.next?.preflight?.capabilityId, "x402-payment-preflight");
  assert.equal(output?.example?.next?.preflight?.endpoint, "https://agentresolver.vercel.app/api/x402-payment-preflight");
  assert.equal(output?.example?.next?.preflight?.priceUsd, 0.001);
  assert.equal(output?.example?.next?.preflight?.method, "GET");
  assert.deepEqual(output?.example?.next?.preflight?.inputExample, {
    url: "https://example.com/api",
    method: "GET",
    maxPriceUsd: 0.01
  });
  assert.equal(output?.example?.next?.settlementVerify?.capabilityId, "x402-settlement-verify");
  assert.equal(output?.example?.next?.settlementVerify?.method, "GET");
  assert.equal(output?.example?.next?.settlementVerify?.priceUsd, 0.001);
  assert.match(output?.example?.next?.settlementVerify?.transactionHashSource || "", /PAYMENT-RESPONSE/);
  assert.equal(
    output?.example?.next?.settlementVerify?.paymentAuthorization,
    "separate_caller_authorization_required"
  );
  assert.equal(output?.example?.next?.single?.capabilityId, "verified-resolve");
  assert.equal(output?.example?.next?.single?.endpoint, "https://agentresolver.vercel.app/api/verified-resolve");
  assert.equal(output?.example?.next?.single?.priceUsd, 0.02);
  assert.deepEqual(output?.example?.next?.single?.inputExample, {
    goal: "Find and verify an MCP server for web search"
  });
  assert.equal(output?.example?.next?.batch?.capabilityId, "batch-verified-resolve");
  assert.equal(output?.example?.next?.batch?.endpoint, "https://agentresolver.vercel.app/api/batch-verified-resolve");
  assert.equal(output?.example?.next?.batch?.priceUsd, 0.05);
  assert.equal(output?.example?.next?.catalogUrl, "https://agentresolver.vercel.app/.well-known/x402");

  const exampleSchema = schemaOutput?.properties?.example;
  assert.equal(exampleSchema?.type, "object");
  assert.equal(exampleSchema?.additionalProperties, false);
  assert.deepEqual(
    exampleSchema?.required,
    ["pong", "settledDelivery", "at", "unixMs", "requestId", "echo", "next"]
  );
  assert.equal(exampleSchema?.properties?.pong?.const, true);
  assert.equal(exampleSchema?.properties?.settledDelivery?.const, true);
  assert.equal(exampleSchema?.properties?.requestId?.format, undefined);
  assert.equal(exampleSchema?.properties?.requestId?.minLength, 36);
  assert.equal(exampleSchema?.properties?.requestId?.maxLength, 36);
  assert.match(exampleSchema?.properties?.requestId?.pattern || "", /0-9a-fA-F/);
  assert.equal(exampleSchema?.properties?.at?.format, undefined);
  assert.equal(exampleSchema?.properties?.at?.minLength, 20);
  assert.equal(exampleSchema?.properties?.at?.maxLength, 35);
  assert.equal(exampleSchema?.properties?.next?.additionalProperties, false);
  assert.deepEqual(exampleSchema?.properties?.next?.required, ["catalogUrl", "recommended", "preflight", "settlementVerify", "single", "batch"]);
  assert.equal(
    exampleSchema?.properties?.next?.properties?.recommended?.properties?.capabilityId?.const,
    "hash-encode"
  );
  assert.equal(
    exampleSchema?.properties?.next?.properties?.recommended?.properties?.repeatUse?.const,
    "when_a_deterministic_hash_or_encoding_transform_is_needed"
  );
  assert.equal(
    exampleSchema?.properties?.next?.properties?.recommended?.properties?.paymentAuthorization?.const,
    "separate_caller_authorization_required"
  );
  assert.equal(
    exampleSchema?.properties?.next?.properties?.preflight?.properties?.capabilityId?.const,
    "x402-payment-preflight"
  );
  assert.equal(
    exampleSchema?.properties?.next?.properties?.settlementVerify?.properties?.capabilityId?.const,
    "x402-settlement-verify"
  );
  assert.equal(
    exampleSchema?.properties?.next?.properties?.settlementVerify?.properties?.paymentAuthorization?.const,
    "separate_caller_authorization_required"
  );
  assert.equal(
    exampleSchema?.properties?.next?.properties?.single?.properties?.capabilityId?.const,
    "verified-resolve"
  );
  assert.equal(
    exampleSchema?.properties?.next?.properties?.batch?.properties?.capabilityId?.const,
    "batch-verified-resolve"
  );
});

test("runtime PAYMENT-REQUIRED handoff follows the exact challenged request", async () => {
  const getResponse = await GET(new NextRequest(
    "https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check",
    {
      method: "GET",
      headers: { "user-agent": "agentresolver-test" }
    }
  ));
  assert.equal(getResponse.status, 402);
  const getHeader = getResponse.headers.get("payment-required");
  assert.ok(getHeader);
  const getChallenge = JSON.parse(Buffer.from(getHeader!, "base64").toString("utf8"));
  assert.equal(getChallenge.extensions?.agentresolver, undefined);
  const getSetupHeader = getResponse.headers.get("x-agentresolver-buyer-setup");
  assert.ok(getSetupHeader);
  const getSetup = new URL(getSetupHeader!);
  assert.equal(getSetup.searchParams.get("method"), "GET");
  assert.equal(
    getSetup.searchParams.get("resumeUrl"),
    "https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check"
  );

  const postResponse = await POST(new NextRequest(
    "https://agentresolver.vercel.app/api/x402-ping",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "agentresolver-test"
      },
      body: JSON.stringify({ echo: "buyer-check" })
    }
  ));
  assert.equal(postResponse.status, 402);
  const postHeader = postResponse.headers.get("payment-required");
  assert.ok(postHeader);
  const postChallenge = JSON.parse(Buffer.from(postHeader!, "base64").toString("utf8"));
  assert.equal(postChallenge.extensions?.agentresolver, undefined);
  const postSetupHeader = postResponse.headers.get("x-agentresolver-buyer-setup");
  assert.ok(postSetupHeader);
  const postSetup = new URL(postSetupHeader!);
  assert.equal(postSetup.searchParams.get("method"), "POST");
  assert.equal(postSetup.searchParams.get("resumeUrl"), null);
});
