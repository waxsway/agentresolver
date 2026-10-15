import test from "node:test";
import assert from "node:assert/strict";
import { classifyTraffic } from "../src/lib/trafficClassification";

test("Dexter x402 schema fetcher is automated traffic, not qualified buyer intent", () => {
  const req = new Request("https://agentresolver.vercel.app/api/procure", {
    method: "POST",
    headers: {
      "user-agent": "dexter-api/x402-schema-fetcher",
      "content-type": "application/json"
    }
  });

  const classification = classifyTraffic(req, {
    path: "/api/procure",
    hasUserIntent: true
  });

  assert.equal(classification.trafficClass, "automated_fetch");
  assert.equal(classification.external, true);
  assert.equal(classification.sponsorEligible, false);
  assert.equal(classification.reason, "known_automated_fetch_user_agent");
});

test("an unrecognized explicit procurement request remains qualified intent", () => {
  const req = new Request("https://agentresolver.vercel.app/api/procure", {
    method: "POST",
    headers: {
      "user-agent": "independent-agent/1.0",
      "content-type": "application/json"
    }
  });

  const classification = classifyTraffic(req, {
    path: "/api/procure",
    hasUserIntent: true
  });

  assert.equal(classification.trafficClass, "qualified_intent");
  assert.equal(classification.external, true);
  assert.equal(classification.sponsorEligible, true);
  assert.equal(classification.reason, "explicit_goal_or_tool_call");
});
