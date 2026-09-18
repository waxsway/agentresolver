import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("NoHumans ping optimization is zero-spend and uses the existing owner token", () => {
  const workflow = readFileSync(".github/workflows/optimize-nohumans-proven-payer-listing.yml", "utf8");
  assert.match(workflow, /NOHUMANS_OWNER_TOKEN/);
  assert.match(workflow, /28e33786-f07/);
  assert.match(workflow, /agentresolver-evidence\.json/);
  assert.match(workflow, /request_schema/);
  assert.match(workflow, /response_schema/);
  assert.match(workflow, /has_sample/);
  assert.doesNotMatch(workflow, /verify-now/);
  assert.doesNotMatch(workflow, /claim\/challenge/);
  assert.doesNotMatch(workflow, /email/);
});
