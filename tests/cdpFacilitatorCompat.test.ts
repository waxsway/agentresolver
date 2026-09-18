import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cdpFacilitatorCapabilities,
  cdpFacilitatorCredentialsPresent,
  cdpFacilitatorEnabled,
  cdpFacilitatorEnabledFor
} from "../src/lib/createDeterministicPaidRoute";
import { AGENTRESOLVER_TRUST_CONTRACT } from "../src/lib/trustContract";

test("CDP facilitator is disabled unless explicitly set to 1", () => {
  assert.equal(cdpFacilitatorEnabled({}), false);
  assert.equal(cdpFacilitatorEnabled({ AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "0" }), false);
  assert.equal(cdpFacilitatorEnabled({ AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "true" }), false);
  assert.equal(cdpFacilitatorEnabled({ AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1" }), true);
});

test("CDP facilitator defaults to the settlement canary only", () => {
  assert.deepEqual([...cdpFacilitatorCapabilities({})], ["x402-ping"]);
  assert.equal(
    cdpFacilitatorEnabledFor("x402-ping", { AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1" }),
    true
  );
  assert.equal(
    cdpFacilitatorEnabledFor("http-inspect", { AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1" }),
    false
  );
  assert.equal(
    cdpFacilitatorEnabledFor("x402-payment-preflight", {
      AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1",
      AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES: "x402-ping,x402-payment-preflight"
    }),
    true
  );
});

test("CDP facilitator requires both API credential fields", () => {
  assert.equal(cdpFacilitatorCredentialsPresent({}), false);
  assert.equal(cdpFacilitatorCredentialsPresent({ CDP_API_KEY_ID: "id" }), false);
  assert.equal(cdpFacilitatorCredentialsPresent({ CDP_API_KEY_SECRET: "secret" }), false);
  assert.equal(cdpFacilitatorCredentialsPresent({
    CDP_API_KEY_ID: "id",
    CDP_API_KEY_SECRET: "secret"
  }), true);
});

test("CDP compatibility preserves the non-custodial trust boundary", () => {
  const cdp = AGENTRESOLVER_TRUST_CONTRACT.optionalPaymentRails.cdpFacilitator;

  assert.equal(cdp.defaultEnabled, false);
  assert.equal(cdp.holdsBuyerFunds, false);
  assert.equal(cdp.buyerAuthorizationRequired, true);
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.paymentModel.custodial, false);
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.paymentModel.forwardsThirdPartyPrincipalPayments, false);
});

test("example configuration keeps CDP facilitator disabled", () => {
  const env = readFileSync(".env.example", "utf8");
  assert.match(env, /^AGENTRESOLVER_CDP_FACILITATOR_ENABLED=0$/m);
  assert.match(env, /^AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES=x402-ping$/m);
});

test("CDP support is opt-in and leaves PayAI as the default primary facilitator", () => {
  const source = readFileSync("src/lib/createDeterministicPaidRoute.ts", "utf8");
  const config = readFileSync("src/lib/x402Config.ts", "utf8");

  assert.match(source, /import\("@coinbase\/cdp-sdk\/x402"\)/);
  assert.match(source, /createCdpFacilitatorClient\(\)/);
  assert.match(source, /const primaryFacilitator = cdpFacilitator \?\? standardFacilitator/);
  assert.match(source, /AGENTRESOLVER_CDP_FACILITATOR_ENABLED requires CDP_API_KEY_ID and CDP_API_KEY_SECRET/);
  assert.match(config, /https:\/\/facilitator\.payai\.network/);
});


test("CDP SDK exposes the hosted facilitator factory without activation", async () => {
  const cdpX402 = await import("@coinbase/cdp-sdk/x402");
  assert.equal(typeof cdpX402.createCdpFacilitatorClient, "function");
});
