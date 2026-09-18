import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sample = JSON.parse(readFileSync("public/x402-ping-sample.json", "utf8"));
const workflow = readFileSync(".github/workflows/publish-nohumans-ping-sample.yml", "utf8");

test("free ping sample is truthful and never claims a sample settlement", () => {
  assert.equal(sample.sample, true);
  assert.equal(sample.product, "x402-ping");
  assert.equal(sample.priceUsd, 0.001);
  assert.equal(sample.paidEndpoint, "https://agentresolver.vercel.app/api/x402-ping");
  assert.equal(sample.paidResponseExample.settledDelivery, true);
  assert.match(sample.important, /does not perform or imply a payment/i);
});

test("NoHumans sample publisher edits only the already-owned paid ping listing", () => {
  assert.match(workflow, /LISTING_ID: 28e33786-f07/);
  assert.match(workflow, /NOHUMANS_OWNER_TOKEN/);
  assert.match(workflow, /-X PATCH "https:\/\/nohumans\.directory\/v1\/listings\/\$LISTING_ID"/);
  assert.match(workflow, /sample_query:\$sample/);
  assert.match(workflow, /x402-ping-sample\.json/);
});

test("NoHumans sample publisher sends no identity and no payment", () => {
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE:/);
  assert.doesNotMatch(workflow, /X-Payment:/);
  assert.doesNotMatch(workflow, /email:\$|CLAIM_EMAIL|claim\/challenge/);
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows: \["Deploy Production"\]/);
});
