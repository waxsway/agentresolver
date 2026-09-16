import test from "node:test";
import assert from "node:assert/strict";
import { assessX402Payment, type HttpInspectReport } from "../src/lib/httpInspect";
import { buildProviderEvidenceReceipt } from "../src/lib/providerEvidenceReceipt";
import { buildX402PrepayDecision } from "../src/lib/x402PrepayDecision";

const target = "https://merchant.example/api/pay";
const payTo = "0x1111111111111111111111111111111111111111";

function reportFor(challenge: Record<string, unknown>, options: Record<string, unknown> = {}): HttpInspectReport {
  const encoded = Buffer.from(JSON.stringify(challenge), "utf8").toString("base64");
  const x402 = assessX402Payment(402, target, encoded, options as any);
  return {
    url: target,
    status: 402,
    ok: false,
    latencyMs: 120,
    contentType: null,
    contentLength: null,
    cacheControl: null,
    etag: null,
    lastModified: null,
    location: null,
    server: null,
    response: { allow: null, vary: null, age: null, contentEncoding: null },
    redirect: { isRedirect: false, location: null },
    dns: { family: 4 },
    tls: {
      protocol: "TLSv1.3",
      authorized: true,
      validFrom: null,
      validTo: null,
      daysRemaining: 90,
      subjectCn: "merchant.example",
      issuerCn: "Test CA"
    },
    security: {
      hsts: true,
      csp: false,
      xContentTypeOptions: false,
      xFrameOptions: false,
      referrerPolicy: false,
      permissionsPolicy: false
    },
    x402,
    trust: {
      scope: "technical_endpoint_and_x402_payment_challenge",
      identityVerified: false,
      fulfillmentVerified: false,
      score: 100,
      infrastructureScore: 100,
      x402Score: x402.score,
      grade: "A",
      verdict: "strong",
      checks: []
    }
  } as HttpInspectReport;
}

function baseChallenge(overrides: Record<string, unknown> = {}) {
  return {
    x402Version: 2,
    resource: { url: target },
    accepts: [{
      scheme: "exact",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo,
      resource: target,
      amount: "5000",
      ...overrides
    }]
  };
}

test("router decision returns exact terms only when strict preflight passes", () => {
  const constraints = {
    maxPriceUsd: 0.01,
    expectedPayTo: payTo,
    expectedNetwork: "eip155:8453"
  };
  const report = reportFor(baseChallenge(), constraints);
  const receipt = buildProviderEvidenceReceipt(report, "2026-09-16T20:00:00.000Z");
  const decision = buildX402PrepayDecision(report, receipt, constraints);

  assert.equal(decision.decision, "eligible");
  assert.equal(decision.eligibleForCallerAuthorization, true);
  assert.equal(decision.reasons.length, 0);
  assert.equal(decision.targetPayment.amountAtomic, "5000");
  assert.equal(decision.targetPayment.payTo, payTo);
  assert.equal(decision.authorizationBoundary.callerMustAuthorizeTargetPayment, true);
  assert.equal(decision.authorizationBoundary.agentResolverSignsTargetPayment, false);
  assert.equal(decision.nextAction.type, "caller_may_authorize_exact_target_payment");
});

test("router decision fails closed on payTo mismatch", () => {
  const constraints = { expectedPayTo: "0x2222222222222222222222222222222222222222" };
  const report = reportFor(baseChallenge(), constraints);
  const decision = buildX402PrepayDecision(report, buildProviderEvidenceReceipt(report), constraints);

  assert.equal(decision.decision, "blocked");
  assert.equal(decision.eligibleForCallerAuthorization, false);
  assert.ok(decision.reasons.includes("expected_payto_mismatch"));
  assert.equal(decision.nextAction.type, "do_not_authorize_target_payment");
});

test("router decision rejects unsupported asset even when generic x402 score is strong", () => {
  const report = reportFor(baseChallenge({ asset: "0x0000000000000000000000000000000000000001" }));
  const decision = buildX402PrepayDecision(report, buildProviderEvidenceReceipt(report));

  assert.equal(decision.decision, "blocked");
  assert.ok(decision.reasons.includes("unsupported_network_or_asset"));
  assert.ok(decision.reasons.includes("usd_amount_unavailable"));
});
