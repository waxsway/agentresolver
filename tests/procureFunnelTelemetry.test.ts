import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("free procurement logs the paid verified-fallback offer as a separate funnel event", () => {
  const route = readFileSync("src/app/api/procure/route.ts", "utf8");

  assert.match(route, /event: "procurement_verification_offer"/);
  assert.match(route, /paidCapabilityId: "verified-resolve"/);
  assert.match(route, /priceUsd: result\.verification\.paidAction\.priceUsd/);
  assert.match(route, /spendingAuthorizationRequired:\s*result\.verification\.paidAction\.spendingAuthorizationRequired/);
  assert.match(route, /topUnknownConstraints: topCandidate\?\.unknownConstraints \|\| \[\]/);
});

test("procurement_call telemetry distinguishes no-selection unknowns from a selected result", () => {
  const route = readFileSync("src/app/api/procure/route.ts", "utf8");

  assert.match(route, /topCandidateStatus: topCandidate\?\.status \|\| null/);
  assert.match(route, /topUnknownConstraintCount: topCandidate\?\.unknownConstraints\.length \|\| 0/);
  assert.match(route, /verificationRecommended: result\.verification\.recommended/);
  assert.match(route, /paidVerificationOffered: Boolean\(result\.verification\.paidAction\)/);
  assert.match(route, /paidVerificationPriceUsd: result\.verification\.paidAction\?\.priceUsd \?\? null/);
});
