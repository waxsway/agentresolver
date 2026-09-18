import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("provider launch Market402 opt-in bypasses self-test quota and never spends operator funds", () => {
  const workflow = readFileSync(".github/workflows/provider-launch-market402-paid-probe.yml", "utf8");
  assert.match(workflow, /provider-launch-check/);
  assert.match(workflow, /declared_price_usd:0\.05/);
  assert.match(workflow, /paid_probe_optin:true/);
  assert.match(workflow, /market402\.com\/submit/);
  assert.doesNotMatch(workflow, /market402\.com\/selftest/);
  assert.match(workflow, /no payment or user funds were used/i);
});
