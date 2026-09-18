import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("NoHumans provider-launch reference registration is buyer-complete and zero-spend", () => {
  const workflow = readFileSync(".github/workflows/register-nohumans-provider-launch-reference.yml", "utf8");
  assert.match(workflow, /provider-launch-check/);
  assert.match(workflow, /price_amount:0\.05/);
  assert.match(workflow, /sample_query/);
  assert.match(workflow, /request_schema/);
  assert.match(workflow, /response_schema/);
  assert.match(workflow, /v1\/resolve/);
  assert.match(workflow, /NOHUMANS_PROVIDER_LAUNCH_REFERENCE_TOKEN/);
  assert.match(workflow, /no Vercel deployment was requested/i);
  assert.doesNotMatch(workflow, /verify-now/);
  assert.doesNotMatch(workflow, /claim\/challenge/);
  assert.doesNotMatch(workflow, /submitter_email/);
});

test("reference listing uses a distinct concrete GET URL instead of duplicating the bare route", () => {
  const workflow = readFileSync(".github/workflows/register-nohumans-provider-launch-reference.yml", "utf8");
  assert.match(workflow, /providerId/);
  assert.match(workflow, /capabilityId/);
  assert.match(workflow, /urlencode/);
  assert.match(workflow, /\("method","GET"\)/);
});
