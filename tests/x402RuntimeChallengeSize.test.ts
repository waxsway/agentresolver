import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/x402-ping/route";
import { x402RuntimeDiscoveryInput, x402RuntimeDiscoveryOutput } from "../src/lib/x402RuntimeDiscovery";

test("x402-ping PAYMENT-REQUIRED stays within an interoperability-friendly header budget", async () => {
  const response = await GET(new NextRequest("https://agentresolver.vercel.app/api/x402-ping", {
    method: "GET",
    headers: { "user-agent": "agentresolver-test" }
  }));

  assert.equal(response.status, 402);
  const paymentRequired = response.headers.get("payment-required");
  assert.ok(paymentRequired);
  assert.ok(
    Buffer.byteLength(paymentRequired, "utf8") < 4096,
    `PAYMENT-REQUIRED is ${Buffer.byteLength(paymentRequired, "utf8")} bytes`
  );

  const decoded = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8")) as any;
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.extensions?.bazaar?.info?.output?.example?.pong, true);
  assert.equal(decoded.extensions?.bazaar?.info?.output?.example?.settledDelivery, true);
  assert.equal(decoded.extensions?.bazaar?.info?.output?.example?.next, undefined);
  assert.equal(decoded.extensions?.agentresolver, undefined);
  assert.equal(
    response.headers.get("x-agentresolver-buyer-setup"),
    "https://agentresolver.vercel.app/api/x402-client-setup?source=x402-challenge&capabilityId=x402-ping&method=GET"
  );
});

test("runtime discovery keeps preflight decision metadata compact", () => {
  const output = x402RuntimeDiscoveryOutput("x402-payment-preflight") as {
    example: {
      prepaymentDecision: {
        decision: string;
        eligibleForCallerAuthorization: boolean;
      };
    };
  };
  assert.equal(output.example.prepaymentDecision.decision, "eligible");
  assert.equal(output.example.prepaymentDecision.eligibleForCallerAuthorization, true);
  assert.ok(JSON.stringify(output).length < 1200);
});


test("Verified Resolve Bazaar input matches the paid POST contract", () => {
  const input = x402RuntimeDiscoveryInput("verified-resolve") as any;
  assert.equal(input.schema.required?.[0], "goal");
  assert.equal(input.schema.properties.maxPriceUsd, undefined);
  assert.equal(input.schema.properties.protocol, undefined);
  assert.ok(input.schema.properties.providerOrigins);
  assert.ok(input.schema.properties.constraints);
  assert.equal(input.schema.properties.constraints.additionalProperties, false);
  assert.ok(input.schema.properties.constraints.properties.maxPriceUsd);
  assert.ok(input.schema.properties.constraints.properties.preferredNetworks);
  assert.equal(input.example.constraints.protocol, "x402");
  assert.deepEqual(input.example.constraints.preferredNetworks, ["eip155:8453"]);
});

test("preflight unsigned GET challenge stays below 4 KB and keeps buyer handoff in headers", async () => {
  const { GET } = await import("../src/app/api/x402-payment-preflight/route");
  const response = await GET(new NextRequest(
    "https://agentresolver.vercel.app/api/x402-payment-preflight?url=https%3A%2F%2Fexample.com%2Fpaid&method=GET&maxPriceUsd=0.01",
    { method: "GET", headers: { "user-agent": "agentresolver-test" } }
  ));
  assert.equal(response.status, 402);
  const paymentRequired = response.headers.get("payment-required");
  assert.ok(paymentRequired);
  assert.ok(
    Buffer.byteLength(paymentRequired, "utf8") < 4096,
    `PAYMENT-REQUIRED is ${Buffer.byteLength(paymentRequired, "utf8")} bytes`
  );
  const decoded = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8")) as any;
  assert.equal(decoded.extensions?.agentresolver, undefined);
  assert.ok(decoded.extensions?.bazaar);
  const body = await response.clone().json() as any;
  assert.equal(body.extensions, undefined);
  assert.deepEqual(body.resource, decoded.resource);
  assert.deepEqual(body.accepts, decoded.accepts);
  assert.ok(
    Buffer.byteLength(JSON.stringify(body), "utf8") <
      Buffer.byteLength(JSON.stringify(decoded), "utf8"),
    "hot Guard/preflight 402 body should not duplicate Bazaar discovery metadata"
  );
  assert.ok(response.headers.get("x-agentresolver-buyer-setup"));
  assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal(response.headers.get("cdn-cache-control"), "public, max-age=30");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "public, max-age=30");
});
