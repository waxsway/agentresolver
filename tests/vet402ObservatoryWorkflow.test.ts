import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(".github/workflows/audit-vet402-autonomous-buyer.yml", "utf8");

test("vet402 audit is observation-only and watches the paid canary", () => {
  assert.match(source, /https:\/\/agentresolver\.vercel\.app\/api\/x402-ping/);
  assert.match(source, /https:\/\/vet402\.com\/api\/v1\/resolve/);
  assert.match(source, /\/observatory\/endpoints\/\$OBSERVATORY_ID\/purchases/);
  assert.match(source, /VET402_INDEPENDENT_SETTLEMENT_OBSERVED=true/);
  assert.doesNotMatch(source, /-X\s+POST/);
  assert.doesNotMatch(source, /PAYMENT-SIGNATURE:/);
  assert.doesNotMatch(source, /Authorization:\s*Bearer/);
});

test("vet402 audit tolerates catalog propagation without failing deploys", () => {
  assert.match(source, /VET402_CATALOGUED=false/);
  assert.match(source, /vet402 has not imported the AgentResolver paid canary yet/);
  assert.match(source, /resolve knows the query shape but has not imported the AgentResolver paid canary yet/);
  assert.match(source, /echo "catalogued=false" >> "\$GITHUB_OUTPUT"/);
  assert.match(source, /workflow_run:/);
  assert.match(source, /schedule:/);
  assert.doesNotMatch(source, /echo "- Resource: \`/);
  assert.match(source, /printf '%s\\n' "- Resource: \$RESOURCE_URL"/);
});
