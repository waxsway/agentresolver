import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/audit-cdp-readiness.yml", "utf8");

test("CDP readiness audit checks production key names without reading secret values", () => {
  assert.match(workflow, /CDP_API_KEY_ID/);
  assert.match(workflow, /CDP_API_KEY_SECRET/);
  assert.match(workflow, /\/v10\/projects\/\$VERCEL_PROJECT_ID\/env\?teamId=\$VERCEL_ORG_ID/);
  assert.match(workflow, /CDP_CREDENTIAL_KEYS_PRESENT/);
  assert.match(workflow, /CDP_COINBASE_PRODUCTION_KEY_NAMES/);
  assert.match(workflow, /CDP_COINBASE_KEY_TARGETS/);
  assert.match(workflow, /matching_targets/);
  assert.match(workflow, /"CDP" in key\.upper\(\) or "COINBASE" in key\.upper\(\)/);
  assert.doesNotMatch(workflow, /decrypt=true/);
  assert.doesNotMatch(workflow, /\/env\/\$|\/env\/\{/);
});

test("CDP readiness audit cannot activate or mutate production", () => {
  assert.doesNotMatch(workflow, /AGENTRESOLVER_CDP_FACILITATOR_ENABLED/);
  assert.doesNotMatch(workflow, /AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES/);
  assert.doesNotMatch(workflow, /vercel deploy|vercel env add|vercel env rm|vercel build/);
  assert.doesNotMatch(workflow, /-X (POST|PUT|PATCH|DELETE).*api\.vercel\.com/);
});

test("CDP readiness audit never signs or spends", () => {
  assert.match(workflow, /test "\$code" = "402"/);
  assert.match(workflow, /No payment was sent/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE|X-PAYMENT/);
});
