import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cdpFacilitatorEnabled } from "../src/lib/createDeterministicPaidRoute";

test("CDP Facilitator rail is disabled unless explicitly set to 1", () => {
  assert.equal(cdpFacilitatorEnabled({}), false);
  assert.equal(cdpFacilitatorEnabled({ AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "0" }), false);
  assert.equal(cdpFacilitatorEnabled({ AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "true" }), false);
  assert.equal(cdpFacilitatorEnabled({ AGENTRESOLVER_CDP_FACILITATOR_ENABLED: "1" }), true);
});

test("example configuration keeps CDP disabled and requires explicit credentials", () => {
  const env = readFileSync(".env.example", "utf8");
  assert.match(env, /^AGENTRESOLVER_CDP_FACILITATOR_ENABLED=0$/m);
  assert.match(env, /^CDP_API_KEY_ID=$/m);
  assert.match(env, /^CDP_API_KEY_SECRET=$/m);
});

test("CDP rail is additive and preferred only when enabled", () => {
  const source = readFileSync("src/lib/createDeterministicPaidRoute.ts", "utf8");

  assert.match(source, /createCdpFacilitatorClient/);
  assert.match(source, /cdpFacilitatorEnabled\(\)/);
  assert.match(source, /CDP_API_KEY_ID/);
  assert.match(source, /CDP_API_KEY_SECRET/);
  assert.match(source, /\.\.\.\(cdpFacilitator \? \[cdpFacilitator\] : \[\]\)/);
  assert.match(source, /standardFacilitator/);
  assert.match(source, /purpose: "bazaar-indexable-settlement"/);
});
