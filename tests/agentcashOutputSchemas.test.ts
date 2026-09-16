import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const openapi = JSON.parse(readFileSync("public/openapi.json", "utf8"));

test("every paid OpenAPI operation has machine-invocable input and output schemas", () => {
  const paid = Object.values(openapi.paths || {})
    .map((item: any) => item?.post)
    .filter((op: any) => op?.tags?.includes("Paid Agent Capabilities"));

  assert.ok(paid.length >= 10);
  for (const op of paid as any[]) {
    assert.ok(op?.requestBody?.content?.["application/json"]?.schema, `${op.operationId} missing input schema`);
    assert.ok(op?.responses?.["200"]?.content?.["application/json"]?.schema, `${op.operationId} missing output schema`);
    assert.ok(op?.responses?.["402"], `${op.operationId} missing 402 response`);
  }
});
