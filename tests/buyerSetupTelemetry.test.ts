import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("buyer setup view telemetry is bounded and uses existing traffic classification", () => {
  const route = readFileSync("src/app/api/x402-client-setup/route.ts", "utf8");

  assert.match(route, /event: "buyer_setup_viewed"/);
  assert.match(route, /classifyTraffic\(req/);
  assert.match(route, /trafficLogFields\(req, traffic\)/);
  assert.match(route, /isDiscovery: true/);
  assert.match(route, /path: "\/api\/x402-client-setup"/);
  assert.match(route, /\n\s*source,\n/);
  assert.match(route, /capabilityId/);
  assert.match(route, /source === "x402-challenge"/);
  assert.match(route, /hasOwnProperty\.call\(PAID_CAPABILITIES, requestedCapabilityId\)/);

  const telemetryStart = route.indexOf('console.log(JSON.stringify({');
  const telemetryEnd = route.indexOf('}));', telemetryStart);
  assert.ok(telemetryStart >= 0 && telemetryEnd > telemetryStart);
  const telemetryBlock = route.slice(telemetryStart, telemetryEnd + 4);

  assert.doesNotMatch(telemetryBlock, /payment-signature/i);
  assert.doesNotMatch(telemetryBlock, /private.?key/i);
  assert.doesNotMatch(telemetryBlock, /payerAddress/i);
  assert.doesNotMatch(telemetryBlock, /req\.text\(|req\.json\(/);
});


test("paid challenge handoff carries source and capability attribution without logging payment secrets", () => {
  const paidRoute = readFileSync("src/lib/createDeterministicPaidRoute.ts", "utf8");
  assert.match(paidRoute, /x402BuyerSetupChallengeUrl\(capabilityId, requestMethod\)/);
  assert.match(paidRoute, /x402BuyerSetupChallengeError\(capabilityId, requestMethod\)/);
  assert.match(
    paidRoute,
    /mirrorPaymentChallengeBody\(\s*response,\s*capabilityId,\s*req\.method\s*\)/s
  );
});
