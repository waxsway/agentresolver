import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("PayAI Bazaar audit retrieves per-resource settlement stats without spending", () => {
  const workflow = readFileSync(".github/workflows/audit-payai-bazaar.yml", "utf8");
  assert.match(workflow, /encoded_resource = urllib\.parse\.quote\(resource, safe=""\)/);
  assert.match(workflow, /settlement_stats = \[\]/);
  assert.match(workflow, /"settlementStats": settlement_stats/);
  assert.match(workflow, /Resource settlement stats/);
  assert.doesNotMatch(workflow, /payment-signature/i);
  assert.doesNotMatch(workflow, /private.?key/i);
});


test("PayAI Bazaar audit filters catalog reads by AgentResolver payTo", () => {
  const workflow = readFileSync(".github/workflows/audit-payai-bazaar.yml", "utf8");
  assert.match(workflow, /'payTo': pay_to/);
  assert.match(workflow, /for pay_to in pay_tos:/);
  assert.match(workflow, /queryTotalsByPayTo/);
  assert.match(workflow, /catalogRequests/);
  assert.doesNotMatch(workflow, /urlencode\(\{'limit': limit, 'offset': page_offset\}\)/);
});


test("PayAI Bazaar audit follows successful production deploys without becoming a release gate", () => {
  const workflow = readFileSync(".github/workflows/audit-payai-bazaar.yml", "utf8");
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows: \["Deploy Production"\]/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /group: audit-payai-bazaar/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /workflow_call:/);
});
