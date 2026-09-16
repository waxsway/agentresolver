import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/x402-ping/route";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

test("x402-ping exposes a payable GET while preserving POST", async () => {
  const getResponse = await GET(new NextRequest("https://agentresolver.vercel.app/api/x402-ping", {
    method: "GET",
    headers: { "user-agent": "agentresolver-test" }
  }));
  assert.equal(getResponse.status, 402);
  const getPaymentRequired = getResponse.headers.get("payment-required");
  assert.ok(getPaymentRequired);
  const getBody = await getResponse.clone().json() as any;
  assert.equal(getBody.x402Version, 2);
  assert.ok(Array.isArray(getBody.accepts));
  assert.ok(getBody.accepts.some((item: any) =>
    item.network === "eip155:8453" &&
    item.amount === "1000" &&
    item.payTo === "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
  ));
  const decodedHeader = JSON.parse(Buffer.from(getPaymentRequired!, "base64").toString("utf8"));
  assert.deepEqual(getBody, decodedHeader);
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
  assert.ok(postResponse.headers.get("payment-required"));
  const postBody = await postResponse.json() as any;
  assert.equal(postBody.x402Version, 2);
  assert.ok(Array.isArray(postBody.accepts));
});

test("generated machine surfaces prefer GET for the settlement canary", () => {
  const manifest = readJson("public/.well-known/x402");
  const capabilities = readJson("public/capabilities.json");
  const integrations = readJson("public/integrations.json");
  const openapi = readJson("public/openapi.json");

  assert.ok(manifest.resources.some((item: any) => item.resource === "GET /api/x402-ping"));
  assert.ok(manifest.resources.some((item: any) => item.resource === "POST /api/x402-ping"));

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
  assert.equal(pathItem.get["x-payment-info"].priceUsd, 0.001);
});
