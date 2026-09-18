import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

test("production deploy is re-armed only after successful main CI", () => {
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.doesNotMatch(workflow, /false &&/);
});

test("production deploy uses the proven prebuilt path and verifies the isolated CDP canary", () => {
  assert.match(workflow, /vercel deploy --prebuilt --prod --token="\$VERCEL_TOKEN"/);
  assert.match(workflow, /api\/x402-cdp-canary/);
  assert.match(workflow, /\.accepts\[0\]\.amount == "2000"/);
  assert.match(workflow, /\.paymentRails\.x402CdpCanary == "coinbase-cdp"/);
  assert.match(workflow, /\.paymentRails\.x402PingBase == "payai"/);
  assert.match(workflow, /CDP_PRODUCTION_SMOKE=true/);
});

test("failed production smoke restores the known-good CDP deployment without rebuilding", () => {
  assert.match(workflow, /if: failure\(\) && steps\.production_deploy\.outcome != 'skipped'/);
  assert.match(workflow, /HEALTHY_DEPLOYMENT_ID: dpl_ErXGyYownF8254n14tDvwwFMiPEv/);
  assert.match(workflow, /HEALTHY_SHA: c2a05df127548c4ecc87ba73467cef72b6e721c3/);
  assert.match(workflow, /\/v2\/deployments\/\$HEALTHY_DEPLOYMENT_ID\/aliases\?teamId=\$VERCEL_ORG_ID/);
  assert.match(workflow, /ROLLBACK_RESTORED_KNOWN_GOOD_CDP=true/);
});
