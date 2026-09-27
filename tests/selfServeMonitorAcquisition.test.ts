import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("self-serve monitor sends humans to a browser-readable live report", () => {
  const page = readFileSync("src/app/monitor/page.tsx", "utf8");
  assert.match(page, /action="\/monitor\/result"/);
  assert.match(page, /Check agent-commerce health — free/);
  assert.match(page, /Optional deeper MCP \+ x402 checks/);
  assert.doesNotMatch(page, /action="\/api\/service-monitor"/);
});

test("monitor result keeps the live check and conversion boundary explicit", () => {
  const page = readFileSync("src/app/monitor/result/page.tsx", "utf8");
  assert.match(page, /runServiceMonitor/);
  assert.match(page, /self_serve_monitor_report_viewed/);
  assert.match(page, /\$19 managed monitor/);
  assert.match(page, /machine-paid through x402/);
  assert.match(page, /card checkout requires merchant onboarding and is not live yet/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
});
