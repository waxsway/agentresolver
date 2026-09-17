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

  assert.doesNotMatch(route, /payment-signature/i);
  assert.doesNotMatch(route, /private.?key/i);
  assert.doesNotMatch(route, /payerAddress/i);
  assert.doesNotMatch(route, /req\.text\(|req\.json\(/);
});
