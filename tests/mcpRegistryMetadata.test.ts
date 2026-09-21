import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("MCP registry metadata leads with the paid Guard and keeps procurement discovery", () => {
  const server = JSON.parse(readFileSync("server.json", "utf8"));
  assert.equal(server.name, "io.github.waxsway/agentresolver");
  assert.equal(server.title, "AgentResolver Guard — Verify x402 Before Paying");
  assert.equal(server.version, "0.2.2");
  assert.match(server.description, /\$0\.001 x402 verify-before-pay Guard/i);\n  assert.match(server.description, /capability procurement/i);
  assert.match(server.description, /provider routing/i);
  assert.equal(server.remotes?.[0]?.url, "https://agentresolver.vercel.app/mcp");
});

test("runtime MCP card and health surface match registry release version", () => {
  const card = readFileSync("src/app/mcp/server-card/route.ts", "utf8");
  const health = readFileSync("src/app/api/health/route.ts", "utf8");
  assert.match(card, /version: "0\.1\.4"/);
  assert.match(card, /AgentResolver Guard — x402 Verify Before Pay/);
  assert.match(health, /version: "0\.1\.4"/);
  assert.match(health, /\$0\.001 USDC non-custodial x402 verify-before-pay Guard/);
});

test("CI and production smoke expect the current release version", () => {
  const ci = readFileSync(".github/workflows/ci.yml", "utf8");
  const workflow = readFileSync(".github/workflows/production-smoke.yml", "utf8");
  assert.match(ci, /"version":"0\.1\.4"/);
  assert.match(workflow, /"version":"0\.1\.4"/);
  assert.match(workflow, /grep -F '0\.1\.4' \/tmp\/server-card\.json/);
});

test("production smoke uses valid Guard GET inputs", () => {
  const workflow = readFileSync(".github/workflows/production-smoke.yml", "utf8");
  assert.match(workflow, /get_path="\$path"/);
  assert.match(workflow, /\/api\/x402-payment-preflight/);
  assert.match(workflow, /\/api\/payment-guard/);
  assert.match(workflow, /url=https%3A%2F%2Fagentresolver\.vercel\.app%2Fapi%2Fx402-ping/);
  assert.match(workflow, /expectedNetwork=eip155%3A8453/);
});

test("production deploy authorizes the tip PR but classifies drift from live production", () => {
  const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");
  assert.match(workflow, /commits\/\$VALIDATED_SHA\/pulls/);
  assert.match(workflow, /x-agentresolver-deployment/);
  assert.match(workflow, /git diff --name-only "\$production_sha" "\$VALIDATED_SHA"/);
  assert.doesNotMatch(workflow, /pulls\/\$RELEASE_PR_NUMBER\/files\?per_page=100&page=\$page/);
  assert.doesNotMatch(workflow, /git rev-parse HEAD\^1/);
});


test("standalone production smoke follows real Vercel events rather than no-op deploy completion", () => {
  const workflow = readFileSync(".github/workflows/production-smoke.yml", "utf8");
  assert.doesNotMatch(workflow, /group: production-smoke/);
  assert.doesNotMatch(workflow, /cancel-in-progress: true/);
  assert.doesNotMatch(workflow, /workflow_run:/);
  assert.match(workflow, /repository_dispatch:/);
  assert.match(workflow, /vercel\.deployment\.success/);
  assert.match(workflow, /vercel\.deployment\.promoted/);
});
