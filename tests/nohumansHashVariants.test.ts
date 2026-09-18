import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("NoHumans hash variant distribution lists only legitimate GET-safe operations", () => {
  const workflow = readFileSync(".github/workflows/register-nohumans-hash-variants.yml", "utf8");
  for (const operation of ["sha512", "base64-encode", "base64-decode", "jwt-decode"]) {
    assert.match(workflow, new RegExp(operation));
  }
  assert.doesNotMatch(workflow, /hmac-sha256/);
  assert.match(workflow, /response_schema/);
  assert.match(workflow, /price_amount:0\.001/);
  assert.match(workflow, /v1\/resolve/);
  assert.doesNotMatch(workflow, /verify-now/);
  assert.doesNotMatch(workflow, /submitter_email/);
  assert.doesNotMatch(workflow, /sample_query/);
});

test("NoHumans utility registration waits for successful production deployment", () => {
  const workflow = readFileSync(".github/workflows/register-nohumans-hash-variants.yml", "utf8");
  assert.match(workflow, /workflow_run/);
  assert.match(workflow, /Deploy Production/);
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
});

test("NoHumans utility registration discards edit credentials instead of persisting them", () => {
  const workflow = readFileSync(".github/workflows/register-nohumans-hash-variants.yml", "utf8");
  assert.match(workflow, /del\(\.claim_token/);
  assert.doesNotMatch(workflow, /VERCEL_TOKEN|NOHUMANS_.*TOKEN|claim\/challenge/);
});
