import assert from "node:assert/strict";
import test from "node:test";
import {
  logLegacyPaidAttempt,
  logLegacyPaidDiscovery
} from "../src/lib/legacyPaidTraffic";

function captureLogs(run: () => void) {
  const original = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    run();
  } finally {
    console.log = original;
  }
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

test("legacy paid smoke traffic is explicitly internal", () => {
  const req = new Request("https://agentresolver.vercel.app/api/http-inspect", {
    method: "POST",
    headers: {
      "user-agent": "curl/8.5.0",
      "x-agentresolver-internal": "1"
    }
  });
  const logs = captureLogs(() => {
    logLegacyPaidAttempt(req, "http-inspect", "/api/http-inspect");
  });
  assert.equal(logs[0].event, "paid_capability_attempt");
  assert.equal(logs[0].trafficClass, "internal_test");
  assert.equal(logs[0].external, false);
  assert.equal(logs[0].sponsorEligible, false);
});

test("legacy signed retries are classified as paid intent", () => {
  const req = new Request("https://agentresolver.vercel.app/api/verified-resolve", {
    method: "POST",
    headers: {
      "user-agent": "buyer-agent/1.0",
      "payment-signature": "signed-payment"
    }
  });
  const logs = captureLogs(() => {
    logLegacyPaidAttempt(req, "verified-resolve", "/api/verified-resolve");
  });
  assert.equal(logs[0].trafficClass, "paid_retry");
  assert.equal(logs[0].external, true);
  assert.equal(logs[0].sponsorEligible, false);
});

test("legacy GET probes are recorded as discovery instead of buyer attempts", () => {
  const req = new Request("https://agentresolver.vercel.app/api/tool-contract", {
    headers: { "user-agent": "generic-agent/1.0" }
  });
  const logs = captureLogs(() => {
    logLegacyPaidDiscovery(req, "tool-contract", "/api/tool-contract");
  });
  assert.equal(logs[0].event, "paid_capability_discovery");
  assert.equal(logs[0].trafficClass, "agent_discovery");
  assert.equal(logs[0].external, true);
});
