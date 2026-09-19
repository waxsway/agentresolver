import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

test("one-shot production release is re-armed only behind successful main CI", () => {
  assert.match(workflow, /One-shot production release gate for the accumulated procurement\/provider batch/);
  assert.doesNotMatch(workflow, /false &&/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /Require validated SHA to still be main/);
  assert.match(workflow, /Require pull-request release/);
  assert.match(workflow, /Coalesce application releases before Vercel build/);
  assert.match(workflow, /Recheck main immediately before deploy/);
});

test("production deploy uses the proven prebuilt path and verifies the isolated CDP canary", () => {
  assert.match(workflow, /vercel deploy --prebuilt --prod --token="\$VERCEL_TOKEN"/);
  assert.match(workflow, /api\/x402-cdp-canary/);
  assert.match(workflow, /\.accepts\[0\]\.amount == "2000"/);
  assert.match(workflow, /\.paymentRails\.x402CdpCanary == "coinbase-cdp"/);
  assert.match(workflow, /\.paymentRails\.x402PingBase == "payai"/);
  assert.match(workflow, /CDP_PRODUCTION_SMOKE=true/);
});

test("failed production smoke restores the current known-good production batch without rebuilding", () => {
  assert.match(workflow, /if: failure\(\) && steps\.production_deploy\.outcome != 'skipped'/);
  assert.match(workflow, /HEALTHY_DEPLOYMENT_ID: dpl_8Qe8sTpT2JA7fdFbLhNogweSKBWL/);
  assert.match(workflow, /HEALTHY_SHA: e32b3e75108ab47ac9fbe3085933e32007dcf01d/);
  assert.match(workflow, /\/v2\/deployments\/\$HEALTHY_DEPLOYMENT_ID\/aliases\?teamId=\$VERCEL_ORG_ID/);
  assert.match(workflow, /\/mcp\/control/);
  assert.match(workflow, /ROLLBACK_RESTORED_KNOWN_GOOD_CDP=true/);
});

test("provider-network release smoke requires live payment-identity verification contract", () => {
  assert.match(workflow, /\.sellerMonetization\.successFeeBps == 200/);
  assert.match(workflow, /\.domainEnrollment\.liveX402ChallengeRequired == true/);
  assert.match(workflow, /\.domainEnrollment\.unsignedEnrollmentProbeOnly == true/);
  assert.match(workflow, /\.providerEnrollment\.liveVerification\.requiredBeforeAttributedProcurement == true/);
  assert.match(workflow, /\.providerEnrollment\.liveVerification\.protocol == "x402-v2"/);
  assert.match(workflow, /\.providerEnrollment\.liveVerification\.failureMode == "fail-closed"/);
});

test("release smoke requires GET procurement compatibility and lean MCP machine defaults", () => {
  assert.match(workflow, /procure_get_ready=0/);
  assert.match(workflow, /api\/procure\?goal=compute%20a%20SHA-256%20digest/);
  assert.match(workflow, /\.constraints\.maxPriceUsd == 0\.01/);
  assert.match(workflow, /MCP_CONTROL_PRODUCTION_SMOKE=true/);
  assert.match(workflow, /\.remotes\[0\]\.url == "https:\/\/agentresolver\.vercel\.app\/mcp\/control"/);
  assert.match(workflow, /\.mcp\.url == "https:\/\/agentresolver\.vercel\.app\/mcp\/control"/);
  assert.match(workflow, /\.mcp\.fullCompatibilityUrl == "https:\/\/agentresolver\.vercel\.app\/mcp"/);
  assert.match(workflow, /\.mcp\.primaryTool == "procure"/);
});
