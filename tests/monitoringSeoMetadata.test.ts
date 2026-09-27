import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public acquisition metadata matches the monitoring product", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const monitor = readFileSync("src/app/monitor/page.tsx", "utf8");
  const docs = readFileSync("src/app/docs/free-github-monitoring/page.tsx", "utf8");

  assert.match(layout, /Agent Commerce Health for API, MCP & x402/);
  assert.match(layout, /isAccessibleForFree: true/);
  assert.match(layout, /AgentResolver Service Monitor/);
  assert.match(layout, /api\/service-monitor/);
  assert.match(monitor, /canonical: "\/monitor"/);
  assert.match(docs, /canonical: "\/docs\/free-github-monitoring"/);
});
