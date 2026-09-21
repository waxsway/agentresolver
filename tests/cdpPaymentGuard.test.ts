import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  basePaymentRailForRoute,
  cdpFacilitatorEnabledForRoute
} from "../src/lib/createDeterministicPaidRoute";

const guardCdpEnv = {
  AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1",
  AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES: "x402-ping,x402-payment-preflight",
  CDI_API_KEY_ID: "id",
  CDI_API_SECRET: "secret"
} as const;

test("CDP Guard is opt-in and canonical Guard stays on PayAI", () => {
  const cdp = { basePaymentRail: "coinbase-cdp" as const };
  assert.equal(basePaymentRailForRoute(cdp), "coinbase-cdp");
  assert.equal(
    cdpFacilitatorEnabledForRoute("x402-payment-preflight", cdp, guardCdpEnv),
    true
  );

  const canonical = readFileSync("src/app/api/payment-guard/route.ts", "utf8");
  assert.doesNotMatch(canonical, /basePaymentRail:\s*"coinbase-cdp"/);
  assert.doesNotMatch(canonical, /priceOverride:/);
});

test("CDP Guard is Base-only, paid GET, and uses the hosted floor", () => {
  const source = readFileSync("src/app/api/cdp-payment-guard/route.ts", "utf8");
  assert.match(source, /endpoint:\s*"\/api\/cdp-payment-guard"/);
  assert.match(source, /paidGet:\s*true/);
  assert.match(source, /priceOverride:\s*"\$0\.002"/);
  assert.match(source, /basePaymentRail:\s*"coinbase-cdp"/);
  assert.match(source, /"x402-payment-preflight"/);
});

test("CDP Guard fails closed unless Preflight is explicitly allowlisted", () => {
  const cdp = { basePaymentRail: "coinbase-cdp" as const };
  assert.equal(
    cdpFacilitatorEnabledForRoute("x402-payment-preflight", cdp, {
      AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1",
      AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES: "x402-ping",
      CDI_API_KEY_ID: "id",
      CDI_API_SECRET: "secret"
    }),
    false
  );
});
