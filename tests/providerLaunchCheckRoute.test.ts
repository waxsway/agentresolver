import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/provider-launch-check/route";

test("provider launch check advertises a $0.05 x402 seller purchase", async () => {
  const response = await GET(new NextRequest(
    "https://agentresolver.vercel.app/api/provider-launch-check",
    { method: "GET", headers: { "user-agent": "provider-seller-test" } }
  ));
  assert.equal(response.status, 402);
  const body = await response.json() as any;
  assert.ok(body.accepts?.some((offer: any) =>
    offer.network === "eip155:8453" &&
    offer.amount === "50000"
  ));
  assert.match(String(body.resource?.description || ""), /provider|seller|distribution/i);
});
