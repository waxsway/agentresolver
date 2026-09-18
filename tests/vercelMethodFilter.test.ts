import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vercel rejects unsupported API mutation methods before Next.js functions", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  const rule = config.routes?.find((item: any) => item.src === "/api/(.*)");

  assert.ok(rule);
  assert.deepEqual(rule.methods, ["PUT", "PATCH", "DELETE"]);
  assert.equal(rule.status, 405);
  assert.equal(rule.headers?.Allow, "GET, HEAD, POST, OPTIONS");
  assert.equal(config.git?.deploymentEnabled, false);
  assert.equal(config.routes.length, 1);
});
