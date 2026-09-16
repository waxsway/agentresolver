import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const openapi = JSON.parse(readFileSync("public/openapi.json", "utf8"));

test("OpenAPI exposes current AgentCash discovery metadata", () => {
  assert.equal(openapi.openapi, "3.1.0");
  assert.match(openapi.info?.["x-guidance"] || "", /free capability discovery/i);
  assert.deepEqual(openapi.paths?.["/api/resolve"]?.post?.security, []);
  assert.deepEqual(openapi.paths?.["/api/health"]?.get?.security, []);

  const paid = Object.values(openapi.paths || {})
    .map((item: any) => item?.post)
    .filter((op: any) => op?.tags?.includes("Paid Agent Capabilities"));

  assert.ok(paid.length >= 10);
  for (const op of paid as any[]) {
    const info = op["x-payment-info"];
    assert.equal(info?.price?.mode, "fixed");
    assert.equal(info?.price?.currency, "USD");
    assert.match(String(info?.price?.amount || ""), /^\d+(?:\.\d+)?$/);
    assert.deepEqual(info?.protocols, [{ x402: {} }]);
    assert.equal(info?.protocol, "x402");
    assert.equal(typeof info?.priceUsd, "number");
  }
});
