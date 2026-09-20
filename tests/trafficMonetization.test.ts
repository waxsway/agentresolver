import assert from "node:assert/strict";
import test from "node:test";
import { classifyTraffic } from "../src/lib/trafficClassification";
import {
  getActiveSponsor,
  sponsorPublicPayload,
  sponsorshipInventory
} from "../src/lib/sponsorship";

test("traffic classifier separates internal, probes, discovery, intent, and payment", () => {
  const internal = classifyTraffic(new Request("https://agentresolver.vercel.app/api/sha256", {
    headers: { "x-agentresolver-internal": "1", "user-agent": "curl/8.5.0" }
  }), { hasUserIntent: true });
  assert.equal(internal.trafficClass, "internal_test");
  assert.equal(internal.external, false);

  const automatedFetch = classifyTraffic(new Request("https://agentresolver.vercel.app/api/x402-ping", {
    headers: { "user-agent": "Vercel MCP Fetch" }
  }));
  assert.equal(automatedFetch.trafficClass, "automated_fetch");
  assert.equal(automatedFetch.external, true);
  assert.equal(automatedFetch.sponsorEligible, false);
  assert.equal(automatedFetch.reason, "known_automated_fetch_user_agent");

  const directory = classifyTraffic(new Request("https://agentresolver.vercel.app/mcp", {
    headers: { "user-agent": "rokmcp-collector/0.2" }
  }), { mcpMethod: "tools/list" });
  assert.equal(directory.trafficClass, "directory_probe");
  assert.equal(directory.sponsorEligible, false);

  const liveness = classifyTraffic(new Request("https://agentresolver.vercel.app/mcp", {
    headers: { "user-agent": "SentinelOracle/0.1 liveness-only" }
  }), { mcpMethod: "tools/list" });
  assert.equal(liveness.trafficClass, "liveness_crawler");


  const payAiBazaar = classifyTraffic(new Request("https://agentresolver.vercel.app/api/x402-ping", {
    headers: { "user-agent": "PayAI-Bazaar/1.0 (+https://docs.payai.network/x402/facilitators/bazaar)" }
  }));
  assert.equal(payAiBazaar.trafficClass, "directory_probe");
  assert.equal(payAiBazaar.sponsorEligible, false);

  const explorer = classifyTraffic(new Request("https://agentresolver.vercel.app/api/x402-ping", {
    headers: { "user-agent": "402explorer/0.1 (+https://discover.paygent.net/about)" }
  }));
  assert.equal(explorer.trafficClass, "directory_probe");
  assert.equal(explorer.sponsorEligible, false);

  const radar = classifyTraffic(new Request("https://agentresolver.vercel.app/api/x402-ping", {
    headers: { "user-agent": "x402-radar-prober/1.0" }
  }));
  assert.equal(radar.trafficClass, "liveness_crawler");
  assert.equal(radar.sponsorEligible, false);

  const mcpCheckup = classifyTraffic(new Request("https://agentresolver.vercel.app/mcp", {
    headers: { "user-agent": "MCPCheckup-Probe/1.0" }
  }), { mcpMethod: "tools/call", tool: "__nonexistent_probe__" });
  assert.equal(mcpCheckup.trafficClass, "liveness_crawler");
  assert.equal(mcpCheckup.sponsorEligible, false);

  const discovery = classifyTraffic(new Request("https://agentresolver.vercel.app/.well-known/x402", {
    headers: { "user-agent": "generic-agent/1.0" }
  }));
  assert.equal(discovery.trafficClass, "agent_discovery");
  assert.equal(discovery.sponsorEligible, true);

  const intent = classifyTraffic(new Request("https://agentresolver.vercel.app/api/resolve", {
    headers: { "user-agent": "generic-agent/1.0" }
  }), { hasUserIntent: true });
  assert.equal(intent.trafficClass, "qualified_intent");

  const paid = classifyTraffic(new Request("https://agentresolver.vercel.app/api/sha256", {
    headers: { "payment-signature": "signed", "user-agent": "generic-agent/1.0" }
  }), { hasUserIntent: true });
  assert.equal(paid.trafficClass, "paid_retry");
  assert.equal(paid.sponsorEligible, false);
});

test("sponsor targeting is explicit, labeled, and independent of organic ranking", () => {
  const keys = [
    "AGENTRESOLVER_SPONSOR_CAMPAIGN_ID",
    "AGENTRESOLVER_SPONSOR_NAME",
    "AGENTRESOLVER_SPONSOR_URL",
    "AGENTRESOLVER_SPONSOR_DESCRIPTION",
    "AGENTRESOLVER_SPONSOR_CATEGORIES"
  ] as const;
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  try {
    process.env.AGENTRESOLVER_SPONSOR_CAMPAIGN_ID = "pilot-1";
    process.env.AGENTRESOLVER_SPONSOR_NAME = "Example Provider";
    process.env.AGENTRESOLVER_SPONSOR_URL = "https://example.com/agent";
    process.env.AGENTRESOLVER_SPONSOR_DESCRIPTION = "Sponsored provider for search workflows.";
    process.env.AGENTRESOLVER_SPONSOR_CATEGORIES = "search,data";

    const match = getActiveSponsor(["search"]);
    assert.ok(match);
    assert.equal(match.disclosure, "sponsored");
    assert.equal(match.organicRankingIndependent, true);
    assert.equal(sponsorPublicPayload(match).name, "Example Provider");
    assert.equal(getActiveSponsor(["media"]), null);
  } finally {
    for (const key of keys) {
      const value = before[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("sponsorship inventory exposes pilot surfaces without publishing a fixed financial commitment", () => {
  const inventory = sponsorshipInventory("https://agentresolver.vercel.app");
  assert.equal(inventory.model, "provider-funded-discovery");
  assert.equal(inventory.organicRankingIndependent, true);
  assert.equal(inventory.rateCard, "operator-approved pilot");
  assert.match(inventory.details, /\/api\/sponsorship$/);
});
