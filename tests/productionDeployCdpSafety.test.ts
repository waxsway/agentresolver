import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

test("automatic production deploy is hard-disabled after the one-shot provider-network release", () => {
  assert.match(workflow, /hard-disabled after the one-shot/);
  assert.match(workflow, /false &&/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /PROVIDER_NETWORK_PRODUCTION_SMOKE=true/);
  assert.match(workflow, /PROCUREMENT_PRODUCTION_SMOKE=true/);
  assert.match(workflow, /\/api\/providers/);
  assert.match(workflow, /provider-success-fee-quote/);
  assert.match(workflow, /provider-success-fee-verify/);
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

test("provider-network smoke reads the live provider contract and rollback preserves procurement", () => {
  assert.match(workflow, /\.sellerMonetization\.successFeeBps == 200/);
  assert.match(workflow, /\.sellerMonetization\.minimumSuccessFeeUsd == 0\.001/);
  assert.match(workflow, /\.sellerMonetization\.buyerExtraFeeUsd == 0/);
  assert.match(workflow, /\.domainEnrollment\.status == "open"/);
  assert.match(workflow, /\.domainEnrollment\.operatorReviewRequired == false/);
  assert.match(workflow, /HEALTHY_DEPLOYMENT_ID: dpl_7f6Up6NZNjjRWUeYFrf3u7sKA8UQ/);
  assert.match(workflow, /HEALTHY_SHA: fe1f69b03fa03e845a516e745772383d46da71d2/);
});
