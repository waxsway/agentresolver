import test from "node:test";
import assert from "node:assert/strict";
import { PAID_CAPABILITIES } from "../src/lib/paidCapabilities";

test("Agent402-facing product names retain proven and missing buyer intents", () => {
  const preflight = PAID_CAPABILITIES["x402-payment-preflight"];
  assert.match(preflight.name, /verify endpoint before paying/i);
  assert.match(preflight.name, /endpoint safety/i);
  assert.match(preflight.name, /USDC payment check/i);

  const canary = PAID_CAPABILITIES["x402-ping"];
  assert.match(canary.name, /x402 settlement test/i);
  assert.match(canary.name, /wallet facilitator payment test/i);
});
