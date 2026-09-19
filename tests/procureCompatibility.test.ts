import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/procure/route.ts", "utf8");
const openapi = JSON.parse(readFileSync("public/openapi.json", "utf8"));

test("procurement keeps compatibility GET and common goal aliases", () => {
  assert.match(route, /export async function GET\(req: Request\)/);
  assert.match(route, /searchParams\.get\("goal"\)/);
  assert.match(route, /searchParams\.get\("task"\)/);
  assert.match(route, /searchParams\.get\("query"\)/);
  assert.match(route, /searchParams\.get\("q"\)/);
  assert.match(route, /GET, POST, OPTIONS/);

  const get = openapi.paths?.["/api/procure"]?.get;
  assert.equal(get?.operationId, "procureCapabilityGet");
  assert.deepEqual(get?.security, []);
  const names = new Set((get?.parameters || []).map((item: any) => item.name));
  for (const name of ["goal", "task", "query", "q", "protocol", "maxPriceUsd"]) {
    assert.equal(names.has(name), true, `missing GET parameter ${name}`);
  }
});

test("procurement machine contract advertises x402, L402, MPP and MCP", () => {
  const post = openapi.paths?.["/api/procure"]?.post;
  const protocol = post?.requestBody?.content?.["application/json"]?.schema
    ?.properties?.constraints?.properties?.protocol;

  assert.deepEqual(protocol?.enum, ["x402", "l402", "mpp", "mcp", "any"]);
  assert.match(post?.description || "", /L402/);
  assert.match(post?.description || "", /MPP/);
});
