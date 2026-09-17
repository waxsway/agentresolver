import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../src/app/api/x402-ping/route";
import { GET as getOpenApi } from "../src/app/openapi.json/route";
import { GET as getIntegrations } from "../src/app/integrations.json/route";
import { x402DiscoveryChallenge } from "../src/lib/x402DiscoveryChallenge";

function makeRequest(method: "GET" | "POST") {
  return new Request("https://agentresolver.vercel.app/api/x402-ping", {
    method,
    headers: {
      "user-agent": "agentresolver-test"
    }
  });
}

test("x402-ping exposes a payable GET while preserving POST", async () => {
  const getResponse = await GET(makeRequest("GET"));
  const postResponse = await POST(makeRequest("POST"));

  assert.equal(getResponse.status, 402);
  assert.equal(postResponse.status, 402);
  assert.ok(getResponse.headers.get("payment-required"));
  assert.ok(postResponse.headers.get("payment-required"));
});

test("generated machine surfaces prefer GET for the settlement canary", async () => {
  const openApi = await (await getOpenApi()).json() as any;
  const integrations = await (await getIntegrations()).json() as any;
  const pathItem = openApi.paths?.["/api/x402-ping"];
  const manifest = integrations.agentresolver;

  assert.ok(pathItem?.get);
  assert.ok(pathItem?.post);
  assert.match(pathItem.get.summary || "", /settlement/i);
  assert.match(pathItem.get.description || "", /wallet/i);
  assert.match(pathItem.get.description || "", /facilitator/i);
  const getManifest = manifest.resources.find((item: any) => item.resource === "GET /api/x402-ping");
  assert.match(getManifest?.description || "", /settlement test/i);
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

  const exampleSchema = schemaOutput?.properties?.example;
  assert.equal(exampleSchema?.type, "object");
  assert.equal(exampleSchema?.additionalProperties, false);
  assert.deepEqual(
    exampleSchema?.required,
    ["pong", "settledDelivery", "at", "unixMs", "requestId", "echo"]
  );
  assert.equal(exampleSchema?.properties?.pong?.const, true);
  assert.equal(exampleSchema?.properties?.settledDelivery?.const, true);
  assert.equal(exampleSchema?.properties?.requestId?.format, undefined);
  assert.equal(exampleSchema?.properties?.requestId?.minLength, 36);
  assert.equal(exampleSchema?.properties?.requestId?.maxLength, 36);
  assert.match(exampleSchema?.properties?.requestId?.pattern || "", /0-9a-fA-F/);
  assert.equal(exampleSchema?.properties?.at?.format, undefined);
  assert.match(exampleSchema?.properties?.at?.pattern || "", /\\d\{4\}/);
});
