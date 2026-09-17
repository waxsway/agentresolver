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
