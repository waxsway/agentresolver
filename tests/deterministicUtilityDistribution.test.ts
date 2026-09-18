import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("deterministic utility distributor opts reusable tools into Market402 paid probes with safe sample inputs", () => {
  const workflow = readFileSync(".github/workflows/distribute-deterministic-utility-pack-once.yml", "utf8");
  const marketStep = workflow.split("Opt reusable utilities into Market402 paid delivery probes")[1]?.split("- name: Register high-signal utilities with 402 Index")[0] || "";

  assert.ok(marketStep.includes("paid_probe_optin:true"));
  assert.ok(marketStep.includes('sample_input:{method:"POST",body:$body}'));
  assert.ok(marketStep.includes('sample_input:{method:"GET",queryParams:{}}'));
  assert.ok(marketStep.includes("hash-encode?operation=sha256&input=agentresolver"));

  for (const capability of [
    "sha256", "sha512", "hmac-sha256", "base64-encode", "base64-decode",
    "jwt-decode", "json-normalize", "json-schema-validate", "url-parse", "slugify"
  ]) {
    assert.ok(marketStep.includes("submit_post " + capability + " "), capability + " missing from paid-probe opt-in");
  }

  assert.ok(!marketStep.includes("submit_post uuid-v4"));
  assert.doesNotMatch(marketStep, /PRIVATE_KEY|SEED|MNEMONIC|PAYMENT-SIGNATURE|X-PAYMENT/i);
});


test("utility distributor verifies live paid endpoints directly instead of repeatedly downloading the public manifest", () => {
  const workflow = readFileSync(".github/workflows/distribute-deterministic-utility-pack-once.yml", "utf8");
  const gate = workflow.split("Verify utility pack on canonical production without manifest sweeps")[1]?.split("- name: Refresh Agent402 origin")[0] || "";

  assert.ok(gate.includes("assert_402 GET /api/x402-ping"));
  assert.ok(gate.includes("assert_402 POST /api/sha256"));
  assert.ok(gate.includes("assert_402 POST /api/json-normalize"));
  assert.ok(!gate.includes("/.well-known/x402"));
  assert.ok(!gate.includes("seq 1 36"));
  assert.ok(!gate.includes("sleep 10"));
});
