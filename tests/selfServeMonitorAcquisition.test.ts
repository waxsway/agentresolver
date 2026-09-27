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


test("monitor acquisition page is included in both sitemap surfaces", () => {
  const generated = readFileSync("src/app/sitemap.ts", "utf8");
  const staticMap = readFileSync("public/sitemap.xml", "utf8");
  assert.match(generated, /weekly\("\/monitor", 0\.98\)/);
  assert.match(staticMap, /https:\/\/agentresolver\.vercel\.app\/monitor/);
});


test("free recurring GitHub monitoring is accountless and non-custodial", () => {
  const action = readFileSync(".github/actions/agent-commerce-health/action.yml", "utf8");
  const docs = readFileSync("src/app/docs/free-github-monitoring/page.tsx", "utf8");
  assert.match(action, /api\/service-monitor/);
  assert.match(action, /fail-on-degraded/);
  assert.match(action, /Hosted hourly monitoring is available/);
  assert.doesNotMatch(action, /PRIVATE_KEY|WALLET_PRIVATE_KEY|PAYMENT-SIGNATURE/);
  assert.match(docs, /No AgentResolver account, API key, wallet, or secret/);
});


test("GitHub Action monitor traffic is attributable without identity data", () => {
  const action = readFileSync(".github/actions/agent-commerce-health/action.yml", "utf8");
  const route = readFileSync("src/app/api/service-monitor/route.ts", "utf8");
  assert.match(action, /AgentResolver-GitHub-Action\/1\.0/);
  assert.match(action, /source=github-action/);
  assert.match(route, /acquisitionSource/);
  assert.match(route, /service_monitor_completed/);
});
