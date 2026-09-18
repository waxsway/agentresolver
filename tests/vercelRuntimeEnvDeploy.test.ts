import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const deployWorkflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");
const activateWorkflow = readFileSync(".github/workflows/activate-cdp-x402-ping.yml", "utf8");
const helper = readFileSync(".github/scripts/vercel-deploy-source-production.mjs", "utf8");
const healthRoute = readFileSync("src/app/api/health/route.ts", "utf8");

test("production deploys build inside Vercel so sensitive runtime env never leaves Vercel", () => {
  const helperInvocation = /node \.github\/scripts\/vercel-deploy-source-production\.mjs/;
  assert.match(deployWorkflow, helperInvocation);
  assert.match(activateWorkflow, helperInvocation);

  for (const workflow of [deployWorkflow, activateWorkflow]) {
    assert.doesNotMatch(workflow, /vercel env run/);
    assert.doesNotMatch(workflow, /vercel pull --yes --environment=production/);
    assert.doesNotMatch(workflow, /vercel build --prod/);
    assert.doesNotMatch(workflow, /vercel-deploy-prebuilt-runtime-env/);
  }

  assert.match(helper, /"deploy",\s*"--prod",\s*"--skip-domain",\s*"--no-wait"/);
  assert.match(helper, /deploymentMeta\.target !== "production"/);
  assert.match(helper, /deploymentMeta\.meta\?\.githubCommitSha !== validatedSha/);
  assert.match(helper, /"curl"/);
  assert.match(helper, /\/api\/x402-cdp-canary/);
  assert.match(helper, /cdpBase\?\.amount !== "2000"/);
  assert.match(helper, /\/api\/x402-ping/);
  assert.match(helper, /payaiBase\?\.amount !== "1000"/);
  assert.match(helper, /x402CdpCanary !== "coinbase-cdp"/);
  assert.match(helper, /circleGatewayEnabled !== false/);
  assert.match(helper, /v10\/projects/);
  assert.match(helper, /promote/);
  assert.doesNotMatch(helper, /CDP_API_KEY_SECRET|CDP_API_SECRET|CDI_API_SECRET/);
});

test("staged source deployment is proven before production promotion", () => {
  const smokeIndex = helper.indexOf("/api/x402-cdp-canary");
  const promoteIndex = helper.indexOf("/promote/");
  assert.ok(smokeIndex >= 0, "missing staged CDP smoke");
  assert.ok(promoteIndex > smokeIndex, "promotion must happen after staged payment-rail smoke");
  assert.match(helper, /trust\?\.deployment\?\.commitSha !== validatedSha/);
  assert.match(helper, /trust\?\.deployment\?\.environment !== "production"/);
});

test("health rail state is evaluated at runtime rather than baked at build time", () => {
  assert.match(healthRoute, /export const dynamic = "force-dynamic"/);
  assert.match(healthRoute, /"cache-control": "private, no-store, max-age=0"/);
  assert.doesNotMatch(healthRoute, /force-static/);
});
