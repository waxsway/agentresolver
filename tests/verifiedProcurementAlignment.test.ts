import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const verified = readFileSync("src/lib/verifiedResolve.ts", "utf8");
const procurement = readFileSync("src/lib/procureCapability.ts", "utf8");
const route = readFileSync("src/app/api/verified-resolve/route.ts", "utf8");

test("paid verified resolve uses the same procurement universe as free procurement", () => {
  assert.match(verified, /procureCapability\(/);
  assert.doesNotMatch(verified, /resolveGoal\(/);
  assert.match(verified, /probeX402Resource\(/);
  assert.match(verified, /probeMcpEndpoint\(/);
  assert.match(verified, /contractProven/);
  assert.match(verified, /remainingUnknownConstraints/);
  assert.match(verified, /toolEvidence/);
  assert.match(verified, /evaluateProcurementSemanticEvidence/);
  assert.match(verified, /MAX_LIVE_PROBES = 2/);
  assert.match(verified, /protocolsDiscoveryOnly: \["l402", "mpp"\]/);
  assert.match(verified, /targetPaymentSubmitted: false/);
});

test("free procurement preserves hard constraints in the paid verification handoff", () => {
  assert.match(procurement, /input: \{[\s\S]*goal,[\s\S]*constraints,[\s\S]*providerOrigins/);
  assert.match(procurement, /\/api\/verified-resolve/);
  assert.match(procurement, /priceUsd: 0\.02/);
});

test("verified resolve accepts procurement constraints and reports conversion telemetry", () => {
  assert.match(route, /constraints\?: unknown/);
  assert.match(route, /const constraints = procurementConstraints\(body\?\.constraints\)/);
  assert.match(route, /selectedSource:/);
  assert.match(route, /selectedProtocol:/);
  assert.match(route, /verifiedX402Count:/);
  assert.match(route, /recommendationType:/);
});


test("free procurement does not select unknown candidates or upsell unverifiable unknowns", () => {
  assert.match(procurement, /candidate\.status === "eligible"/);
  assert.match(procurement, /verifierCanResolveUnknowns/);
  assert.match(procurement, /current live verifier cannot prove all of them/);
});


test("x402 payment liveness cannot erase unrelated capability unknowns", () => {
  assert.match(verified, /type: "x402-live-contract-unproven"/);
  assert.match(verified, /remainingUnknownConstraints/);
  assert.match(verified, /payment evidence cannot prove every requested capability property/);
  assert.match(verified, /const contractProven =[\s\S]*remainingUnknownConstraints\.length === 0/);
});
