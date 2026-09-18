import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/register-paywitness-paid-canary-once.yml", "utf8");

test("Paywitness zero-spend registration retries independently of app deploys", () => {
  assert.match(workflow, /schedule:\s*\n\s*- cron: "23 \* \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /workflow_run:/);
  assert.doesNotMatch(workflow, /workflows: \["Deploy Production"\]/);
  assert.match(workflow, /no payment was attempted/i);
  assert.match(workflow, /POST 'https:\/\/paywitness\.ai\/list'/);
  assert.match(workflow, /200\|201\|202\|204\|409/);
  assert.match(workflow, /402\)/);
});
