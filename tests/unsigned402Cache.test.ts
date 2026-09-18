import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/x402-ping/route";

test("unsigned GET payment challenges are edge-cacheable for a short bounded window", async () => {
  const response = await GET(new NextRequest("https://agentresolver.vercel.app/api/x402-ping", {
    method: "GET",
    headers: { "user-agent": "agentresolver-cache-test" }
  }));
  assert.equal(response.status, 402);
  assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal(response.headers.get("cdn-cache-control"), "public, max-age=30");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "public, max-age=30");
});
