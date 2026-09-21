import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("NoHumans Guard optimization is zero-spend and targets the existing listing", () => {
  const workflow = readFileSync(".github/workflows/optimize-nohumans-guard-listing.yml", "utf8");

  assert.match(workflow, /628b5619-143/);
  assert.match(workflow, /NOHUMANS_OWNER_TOKEN/);
  assert.match(workflow, /sample_query/);
  assert.match(workflow, /request_schema/);
  assert.match(workflow, /response_schema/);
  assert.match(workflow, /payment-guard\?url=/);
  assert.match(workflow, /x-claim-token/);
  assert.doesNotMatch(workflow, /verify-now/);
  assert.doesNotMatch(workflow, /claim\/challenge/);
  assert.doesNotMatch(workflow, /private.?key|seed phrase|evmPrivateKey|solanaPrivateKey/i);
});
