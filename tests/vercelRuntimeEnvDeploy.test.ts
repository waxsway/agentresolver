import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const deployWorkflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");
const activateWorkflow = readFileSync(".github/workflows/activate-cdp-x402-ping.yml", "utf8");
const helper = readFileSync(".github/scripts/vercel-deploy-prebuilt-runtime-env.mjs", "utf8");
const healthRoute = readFileSync("src/app/api/health/route.ts", "utf8");

test("prebuilt production deploys forward pulled project env into runtime", () => {
  const helperInvocation = /node \.github\/scripts\/vercel-deploy-prebuilt-runtime-env\.mjs \.vercel\/\.env\.production\.local/;
  assert.match(deployWorkflow, helperInvocation);
  assert.match(activateWorkflow, helperInvocation);
  assert.doesNotMatch(deployWorkflow, /vercel deploy --prebuilt --prod --token/);
  assert.doesNotMatch(activateWorkflow, /vercel deploy --prebuilt --prod --token/);
  assert.match(helper, /parseEnv/);
  assert.match(helper, /args\.push\("--env"/);
  assert.match(helper, /startsWith\("VERCEL_"\)/);
});

test("health rail state is evaluated at runtime rather than baked at build time", () => {
  assert.match(healthRoute, /export const dynamic = "force-dynamic"/);
  assert.match(healthRoute, /"cache-control": "private, no-store, max-age=0"/);
  assert.doesNotMatch(healthRoute, /force-static/);
});
