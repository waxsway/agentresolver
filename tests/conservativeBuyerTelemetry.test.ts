import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyTraffic } from "../src/lib/trafficClassification";

test("unsigned paid-route POSTs are not claimed as qualified buyers", () => {
  const req = new Request("https://agentresolver.vercel.app/api/x402-payment-preflight", {
    method: "POST",
    headers: { "user-agent": "node" }
  });
  const traffic = classifyTraffic(req, { path: "/api/x402-payment-preflight" });

  assert.equal(traffic.trafficClass, "unknown_external");
  assert.equal(traffic.external, true);
});

test("signed retries remain the strongest conversion signal", () => {
  const req = new Request("https://agentresolver.vercel.app/api/x402-payment-preflight", {
    method: "POST",
    headers: {
      "user-agent": "node",
      "payment-signature": "opaque-test-signature"
    }
  });
  const traffic = classifyTraffic(req, { path: "/api/x402-payment-preflight" });

  assert.equal(traffic.trafficClass, "paid_retry");
  assert.equal(traffic.reason, "payment_signature_present");
});

test("paid capability schemas avoid unsupported uri formats", () => {
  const source = readFileSync("src/lib/paidCapabilities.ts", "utf8");
  assert.doesNotMatch(source, /format:\s*"uri"/);
  assert.ok(source.includes('endpoint: { type: "string", pattern: "^https://", maxLength: 500 }'));
  assert.ok(source.includes('specUrl: { type: "string", pattern: "^https://", maxLength: 500 }'));
});
