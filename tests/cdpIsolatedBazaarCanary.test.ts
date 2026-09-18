import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  basePaymentRailForRoute,
  cdpFacilitatorEnabledForRoute,
  telemetryEnvForRoute
} from "../src/lib/createDeterministicPaidRoute";
import { configuredPaymentRail } from "../src/lib/telemetry";

const cdpEnv = {
  AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1",
  AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES: "x402-ping",
  CDI_API_KEY_ID: "id",
  CDI_API_SECRET: "secret"
} as const;

test("existing paid routes remain PayAI by default even when CDP is globally enabled", () => {
  assert.equal(basePaymentRailForRoute({}), "payai");
  assert.equal(cdpFacilitatorEnabledForRoute("x402-ping", {}, cdpEnv), false);

  const telemetryEnv = telemetryEnvForRoute({}, cdpEnv);
  assert.equal(configuredPaymentRail("x402-ping", telemetryEnv), "payai");
});

test("the isolated Bazaar canary explicitly selects Coinbase CDP", () => {
  const options = { basePaymentRail: "coinbase-cdp" as const };
  assert.equal(basePaymentRailForRoute(options), "coinbase-cdp");
  assert.equal(cdpFacilitatorEnabledForRoute("x402-ping", options, cdpEnv), true);

  const telemetryEnv = telemetryEnvForRoute(options, cdpEnv);
  assert.equal(configuredPaymentRail("x402-ping", telemetryEnv), "coinbase-cdp");
  assert.equal(telemetryEnv.AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED, "0");
});

test("CDP-only route fails closed when CDP is not enabled for the capability", () => {
  const options = { basePaymentRail: "coinbase-cdp" as const };
  assert.equal(
    cdpFacilitatorEnabledForRoute("x402-ping", options, {
      AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "0"
    }),
    false
  );
  assert.equal(
    cdpFacilitatorEnabledForRoute("http-inspect", options, cdpEnv),
    false
  );
});

test("CDP canary source is Base-only and has no PayAI fallback", () => {
  const factory = readFileSync("src/lib/createDeterministicPaidRoute.ts", "utf8");
  const route = readFileSync("src/app/api/x402-cdp-canary/route.ts", "utf8");

  assert.match(route, /endpoint:\s*"\/api\/x402-cdp-canary"/);
  assert.match(route, /basePaymentRail:\s*"coinbase-cdp"/);
  assert.match(factory, /cdpOnly\s*\?\s*new x402ResourceServer\(cdpBaseFacilitator!\)/);
  assert.match(factory, /if \(!cdpOnly\) \{\s*server\.register\(X402_SOLANA_NETWORK/);
  assert.match(factory, /\.\.\.\(!cdpOnly \? \[\{/);
  assert.match(factory, /CDP-only route requires AGENTRESOLVER_CDP_FACILITATOR_ENABLED=1/);
});

test("canonical x402-ping route does not opt into Coinbase CDP", () => {
  const route = readFileSync("src/app/api/x402-ping/route.ts", "utf8");
  assert.doesNotMatch(route, /basePaymentRail:\s*"coinbase-cdp"/);
});
