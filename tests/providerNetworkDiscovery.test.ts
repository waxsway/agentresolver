import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public discovery retains provider routing and provider-funded settlement surfaces", () => {
  const compact = readFileSync("scripts/compact-public-paid-discovery.ts", "utf8");
  assert.match(compact, /provider-attribution-settle/);
  assert.match(compact, /\/api\/providers/);
  assert.match(compact, /\/api\/execute/);
  assert.match(compact, /x-agentresolver-attribution-id/);

  const integration = JSON.parse(readFileSync("public/provider-integration.json", "utf8"));
  assert.equal(integration.safety.arbitraryProxying, false);
  assert.equal(integration.safety.callerSpendingAuthorized, false);
  assert.equal(integration.providerFundedPilot.feeUsd, 0.001);
});
