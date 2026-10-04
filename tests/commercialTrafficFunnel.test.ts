import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  callerHash,
  callerNetworkHash,
  requestCountry
} from "../src/lib/telemetry";
import {
  classifyTraffic,
  trafficLogFields
} from "../src/lib/trafficClassification";

test("observed ecosystem probes are excluded from commercial traffic", () => {
  const livenessAgents = [
    "CarbonMonitor/0.1 healthcheck (+https://carbon-cashmere.de)",
    "mako-pulse-prober/0.1",
    "x402-observer/1.0 (uptime+trust monitor; +https://x402-trust.com/trust)",
    "lumiere-paycheck-prober/1.0 (+https://lumierepaycheck.org)",
    "SettledProbe/0.1 (+https://settled.tools/bot; unpaid liveness check, never settles)",
    "x402watch/1 (+https://x402watch.vercel.app)",
    "x402-census-probe/2.1 (independent index research)",
    "PayAPI-HealthCheck/1.0",
    "probe402/0.1.0 (+https://probe402.com/method)",
    "Nitrograph-HealthCheck/1.0 (+https://api.nitrograph.com/bot)"
  ];

  for (const userAgent of livenessAgents) {
    const traffic = classifyTraffic(new Request("https://agentresolver.vercel.app/api/x402-ping", {
      headers: { "user-agent": userAgent }
    }));
    assert.equal(traffic.trafficClass, "liveness_crawler", userAgent);
    assert.equal(traffic.sponsorEligible, false, userAgent);
  }

  const directoryAgents = [
    "CoinbaseBazaarDiscovery/1.0 (+https://docs.cdp.coinbase.com/x402)",
    "agent-tools.cloud-crawler/0.1 (+https://agent-tools.cloud)",
    "AgentIndexBot/0.1 (+https://agents.traderszone.net; polite ARD crawler)",
    "easy402-indexer/1",
    "BrickBlueBot/0.1 (+https://brick.blue/bot; agentic-web registry)"
  ];

  for (const userAgent of directoryAgents) {
    const traffic = classifyTraffic(new Request("https://agentresolver.vercel.app/api/x402-ping", {
      headers: { "user-agent": userAgent }
    }));
    assert.equal(traffic.trafficClass, "directory_probe", userAgent);
    assert.equal(traffic.sponsorEligible, false, userAgent);
  }
});

test("self-declared no-payment probes cannot masquerade as buyer traffic", () => {
  const traffic = classifyTraffic(new Request("https://agentresolver.vercel.app/api/x402-ping", {
    headers: { "user-agent": "agent-market-probe/0.1 (+measures reachability only; no payment, no auth)" }
  }));

  assert.equal(traffic.trafficClass, "liveness_crawler");
  assert.equal(traffic.sponsorEligible, false);
  assert.equal(traffic.reason, "self_declared_non_buyer_user_agent");
});

test("caller grouping is privacy-safe and stable across an IPv4 /24", () => {
  const a = new Request("https://agentresolver.vercel.app/api/x402-ping", {
    headers: {
      "x-vercel-forwarded-for": "203.0.113.42",
      "x-vercel-ip-country": "us",
      "user-agent": "node"
    }
  });
  const b = new Request("https://agentresolver.vercel.app/api/x402-ping", {
    headers: {
      "x-vercel-forwarded-for": "203.0.113.99",
      "x-vercel-ip-country": "US",
      "user-agent": "node"
    }
  });
  const c = new Request("https://agentresolver.vercel.app/api/x402-ping", {
    headers: {
      "x-vercel-forwarded-for": "203.0.114.1",
      "x-vercel-ip-country": "US",
      "user-agent": "node"
    }
  });

  assert.notEqual(callerHash(a), callerHash(b));
  assert.equal(callerNetworkHash(a), callerNetworkHash(b));
  assert.notEqual(callerNetworkHash(a), callerNetworkHash(c));
  assert.equal(requestCountry(a), "US");

  const fields = trafficLogFields(a, classifyTraffic(a));
  assert.equal(fields.ipCountry, "US");
  assert.ok(fields.callerNetworkHash);
  assert.doesNotMatch(JSON.stringify(fields), /203\.0\.113/);
});

test("buyer funnel emits only meaningful post-challenge stages", () => {
  const buyerSetup = readFileSync("src/app/api/x402-client-setup/route.ts", "utf8");
  const telemetry = readFileSync("src/lib/telemetry.ts", "utf8");

  assert.match(buyerSetup, /event: "buyer_funnel_stage"/);
  assert.match(buyerSetup, /stage: "challenge_setup_viewed"/);
  assert.match(buyerSetup, /source === "x402-challenge" && capabilityId/);

  assert.match(telemetry, /event: "buyer_funnel_stage"/);
  assert.match(telemetry, /stage: "payment_submitted"/);
  assert.match(telemetry, /if \(paymentAttempt\.hasPaymentAttempt\)/);
  assert.match(telemetry, /callerNetworkHash/);
  assert.match(telemetry, /ipCountry/);
});
