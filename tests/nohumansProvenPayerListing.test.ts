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
  assert.doesNotMatch(workflow, /CLAIM_EMAIL/);
  assert.doesNotMatch(workflow, /--data .*email/);
});


test("NoHumans optimization retrieves the sensitive owner token through Vercel's decrypt API without printing it", () => {
  const workflow = readFileSync(".github/workflows/optimize-nohumans-proven-payer-listing.yml", "utf8");
  assert.match(workflow, /api\.vercel\.com\/v10\/projects\/\$VERCEL_PROJECT_ID\/env/);
  assert.match(workflow, /decrypt=true/);
  assert.match(workflow, /Authorization: Bearer \$VERCEL_TOKEN/);
  assert.match(workflow, /::add-mask::\$token/);
  assert.doesNotMatch(workflow, /vercel env pull/);
});
