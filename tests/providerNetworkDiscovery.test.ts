import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("provider routing is machine-readable without expanding the broad paid catalog", () => {
  const compact = readFileSync("scripts/compact-public-paid-discovery.ts", "utf8");
  assert.match(compact, /\/api\/providers/);
  assert.match(compact, /\/api\/execute/);
  assert.match(compact, /x-agentresolver-attribution-id/);

  const integration = JSON.parse(readFileSync("public/provider-integration.json", "utf8"));
  assert.equal(integration.safety.arbitraryProxying, false);
  assert.equal(integration.safety.callerSpendingAuthorized, false);
  assert.equal(integration.providerFundedPilot.feeUsd, 0.001);
  assert.match(integration.providerFundedPilot.settlement, /provider-attribution-settle/);

  const publicManifest = JSON.parse(readFileSync("public/.well-known/x402", "utf8"));
  assert.equal(
    (publicManifest.services || []).some((item: any) => item.id === "provider-attribution-settle"),
    false
  );
});
