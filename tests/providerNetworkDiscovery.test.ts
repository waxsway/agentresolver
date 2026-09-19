import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("provider routing publishes zero-account domain enrollment without exposing fee collection as buyer-paid x402 discovery", () => {
  const compact = readFileSync("scripts/compact-public-paid-discovery.ts", "utf8");
  assert.match(compact, /\/api\/providers/);
  assert.match(compact, /\/api\/execute/);
  assert.match(compact, /x-agentresolver-attribution-id/);
  assert.match(compact, /provider-success-fee-quote/);
  assert.match(compact, /successFeeBps: 200/);

  const integration = JSON.parse(
    readFileSync("public/provider-integration.json", "utf8")
  );
  assert.equal(integration.safety.arbitraryProxying, false);
  assert.equal(integration.safety.callerSpendingAuthorized, false);
  assert.equal(integration.safety.buyerFundsCustodied, false);
  assert.equal(integration.providerEnrollment.mode, "domain-controlled-well-known");
  assert.equal(integration.providerEnrollment.reviewRequired, false);
  assert.equal(integration.commercial.successFeeBps, 200);
  assert.equal(integration.commercial.minimumSuccessFeeUsd, 0.001);
  assert.equal(integration.commercial.buyerExtraFeeUsd, 0);
  assert.match(integration.commercial.feeQuote, /provider-success-fee-quote/);
  assert.match(integration.commercial.feeVerification, /provider-success-fee-verify/);

  const publicManifest = JSON.parse(
    readFileSync("public/.well-known/x402", "utf8")
  );
  assert.equal(
    (publicManifest.services || []).some(
      (item: any) => item.id === "provider-launch-check"
    ),
    true
  );
  assert.equal(
    (publicManifest.services || []).some(
      (item: any) => item.id === "provider-attribution-settle"
    ),
    false
  );
  assert.equal(
    (publicManifest.services || []).some(
      (item: any) => item.id === "provider-success-fee-quote"
    ),
    false
  );
});
