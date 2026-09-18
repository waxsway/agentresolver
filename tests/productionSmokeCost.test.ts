import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/production-smoke.yml", "utf8");

test("production smoke exercises only the live revenue funnel", () => {
  assert.match(workflow, /\/api\/x402-ping/);
  assert.match(workflow, /\/api\/payment-guard\?url=/);
  assert.match(workflow, /\/api\/x402-payment-preflight\?url=/);
  assert.match(workflow, /check_post_challenge "\/api\/verified-resolve"/);
  assert.match(workflow, /check_post_challenge "\/api\/batch-verified-resolve"/);
  assert.match(workflow, /recommendedPaidAction\.capabilityId == "x402-payment-preflight"/);

  const paidPostChecks = workflow.match(/check_post_challenge "\/api\//g) ?? [];
  assert.equal(paidPostChecks.length, 2, "production smoke must not sweep legacy paid POST routes");
});

test("production smoke no longer runs the legacy paid utility matrix", () => {
  assert.doesNotMatch(workflow, /check_402\s+'ABI Encode'/);
  assert.doesNotMatch(workflow, /check_402\s+'SHA-256'/);
  assert.doesNotMatch(workflow, /check_402\s+'MCP Live Preflight'/);
  assert.doesNotMatch(workflow, /check_unpaid_mcp_tool/);
  assert.doesNotMatch(workflow, /Direct paid HTTP Inspect MCP challenge/);
  assert.doesNotMatch(workflow, /All POST and GET x402 challenges verified/);
});

test("production smoke does not double-trigger from Vercel repository dispatch", () => {
  assert.doesNotMatch(workflow, /repository_dispatch:/);
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflow_dispatch:/);
});

test("production smoke still locks the compact public catalog", () => {
  assert.match(workflow, /\(\.paths \| keys \| length\) == 12/);
  assert.match(workflow, /\.paths\["\/api\/sha256"\] == null/);
  assert.match(workflow, /\.paths\["\/api\/mcp-probe"\] == null/);
  assert.match(workflow, /\.paths\["\/api\/agent-readiness"\] == null/);
});
