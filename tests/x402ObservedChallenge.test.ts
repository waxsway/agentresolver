import assert from "node:assert/strict";
import test from "node:test";
import {
  applyObservedX402PaymentChallenge,
  type HttpInspectReport
} from "../src/lib/httpInspect";
import { buildX402PaymentGuardResult } from "../src/lib/x402PaymentGuard";

const target = "https://merchant.example/mcp";
const payTo = "0x1111111111111111111111111111111111111111";

function safeHeadProbe(): HttpInspectReport {
  return {
    url: target,
    status: 405,
    ok: false,
    latencyMs: 35,
    contentType: null,
    contentLength: null,
    cacheControl: null,
    etag: null,
    lastModified: null,
    location: null,
    server: null,
    response: { allow: "POST", vary: null, age: null, contentEncoding: null },
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
    x402: {
      detected: false,
      challengeHeaderPresent: false,
      parseable: false,
      version: null,
      acceptCount: 0,
      scheme: null,
      network: null,
      asset: null,
      payTo: null,
      resource: null,
      amountAtomic: null,
      amountUsd: null,
      score: null,
      verdict: "not-detected",
      checks: []
    },
    trust: {
      scope: "technical_endpoint_and_x402_payment_challenge",
      identityVerified: false,
      fulfillmentVerified: false,
      score: 100,
      infrastructureScore: 100,
      x402Score: null,
      grade: "A",
      verdict: "strong",
      checks: []
    }
  };
}

test("validates a caller-observed POST 402 without replaying the POST body", () => {
  const challenge = {
    x402Version: 2,
    resource: { url: target },
    accepts: [{
      scheme: "exact",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo,
      amount: "1000"
    }]
  };

  const report = applyObservedX402PaymentChallenge(
    safeHeadProbe(),
    challenge,
    {
      expectedPayTo: payTo,
      expectedNetwork: "eip155:8453",
      maxPriceUsd: 0.01
    }
  );
  const result = buildX402PaymentGuardResult(report, {
    expectedPayTo: payTo,
    expectedNetwork: "eip155:8453",
    maxPriceUsd: 0.01
  });

  assert.equal(report.status, 402);
  assert.equal(report.x402.resource, target);
  assert.equal(report.x402.amountAtomic, "1000");
  assert.equal(result.prepaymentDecision.decision, "eligible");
  assert.equal(result.prepaymentDecision.targetPayment.payTo, payTo);
});

test("caller-observed challenge still fails closed on recipient mismatch", () => {
  const challenge = {
    x402Version: 2,
    resource: { url: target },
    accepts: [{
      scheme: "exact",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x2222222222222222222222222222222222222222",
      amount: "1000"
    }]
  };

  const constraints = {
    expectedPayTo: payTo,
    expectedNetwork: "eip155:8453"
  };
  const report = applyObservedX402PaymentChallenge(
    safeHeadProbe(),
    challenge,
    constraints
  );
  const result = buildX402PaymentGuardResult(report, constraints);

  assert.equal(result.prepaymentDecision.decision, "blocked");
  assert.ok(result.prepaymentDecision.reasons.includes("expected_payto_mismatch"));
});

