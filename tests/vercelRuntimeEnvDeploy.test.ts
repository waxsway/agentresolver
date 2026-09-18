import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const deployWorkflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");
const activateWorkflow = readFileSync(".github/workflows/activate-cdp-x402-ping.yml", "utf8");
const healthRoute = readFileSync("src/app/api/health/route.ts", "utf8");

test("prebuilt production deploys preserve Vercel project Secrets through the proven deploy path", () => {
  const directPrebuiltDeploy = /vercel deploy --prebuilt --prod --token="\$VERCEL_TOKEN"/;
  assert.match(deployWorkflow, directPrebuiltDeploy);
  assert.match(activateWorkflow, directPrebuiltDeploy);
  assert.doesNotMatch(deployWorkflow, /vercel-deploy-prebuilt-runtime-env/);
  assert.doesNotMatch(activateWorkflow, /vercel-deploy-prebuilt-runtime-env/);
  assert.doesNotMatch(deployWorkflow, /vercel env run/);
  assert.doesNotMatch(activateWorkflow, /vercel env run/);
  assert.match(deployWorkflow, /vercel pull --yes --environment=production/);
  assert.match(activateWorkflow, /vercel pull --yes --environment=production/);
});

test("health rail state is evaluated at runtime rather than baked at build time", () => {
  assert.match(healthRoute, /export const dynamic = "force-dynamic"/);
  assert.match(healthRoute, /"cache-control": "private, no-store, max-age=0"/);
  assert.doesNotMatch(healthRoute, /force-static/);
});
