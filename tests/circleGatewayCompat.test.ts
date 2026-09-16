import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { circleGatewayEnabled } from "../src/lib/createDeterministicPaidRoute";
import { AGENTRESOLVER_TRUST_CONTRACT } from "../src/lib/trustContract";

test("Circle Gateway rail is disabled unless explicitly set to 1", () => {
  assert.equal(circleGatewayEnabled({}), false);
  assert.equal(circleGatewayEnabled({ AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED: "0" }), false);
  assert.equal(circleGatewayEnabled({ AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED: "true" }), false);
  assert.equal(circleGatewayEnabled({ AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED: "1" }), true);
});

test("Gateway compatibility preserves the non-custodial trust boundary", () => {
  const gateway = AGENTRESOLVER_TRUST_CONTRACT.optionalPaymentRails.circleGatewayNanopayments;

  assert.equal(gateway.defaultEnabled, false);
  assert.equal(gateway.holdsBuyerFunds, false);
  assert.equal(gateway.buyerAuthorizationRequired, true);
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.paymentModel.custodial, false);
  assert.equal(AGENTRESOLVER_TRUST_CONTRACT.paymentModel.forwardsThirdPartyPrincipalPayments, false);
});

test("example configuration keeps Gateway disabled", () => {
  const env = readFileSync(".env.example", "utf8");
  assert.match(env, /^AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED=0$/m);
});

test("Gateway support is additive to the existing PayAI and Solana rails", () => {
  const source = readFileSync("src/lib/createDeterministicPaidRoute.ts", "utf8");

  assert.match(source, /new HTTPFacilitatorClient/);
  assert.match(source, /new BatchFacilitatorClient/);
  assert.match(source, /new GatewayEvmScheme/);
  assert.match(source, /new ExactSvmScheme/);
  assert.match(source, /circleGatewayEnabled\(\)/);
  assert.match(source, /await server\.initialize\(\)/);
});
