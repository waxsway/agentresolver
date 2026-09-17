import test from "node:test";
import assert from "node:assert/strict";
import { assessX402Payment, type HttpInspectReport } from "../src/lib/httpInspect";
import { buildX402PaymentGuardResult } from "../src/lib/x402PaymentGuard";

const target = "https://merchant.example/api/pay";
const payTo = "0x1111111111111111111111111111111111111111";

function report(constraints: Record<string, unknown> = { maxPriceUsd: 0.01, expectedPayTo: payTo, expectedNetwork: "eip155:8453" }): HttpInspectReport {
  const challenge = {
    x402Version: 2,
    resource: { url: target },
    accepts: [{
      scheme: "exact",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo,
      resource: target,
      amount: "5000"
    }]
  };
  const encoded = Buffer.from(JSON.stringify(challenge), "utf8").toString("base64");
  const x402 = assessX402Payment(402, target, encoded, constraints as any);
  return {
    url: target,
    status: 402,
    ok: false,
    latencyMs: 50,
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
  };
}

test("AgentResolver Guard returns the same fail-closed decision and evidence envelope for every surface", () => {
  const result = buildX402PaymentGuardResult(
    report(),
    { maxPriceUsd: 0.01, expectedPayTo: payTo, expectedNetwork: "eip155:8453" },
    "2026-09-17T22:00:00.000Z"
  );

  assert.equal(result.guard.product, "AgentResolver Guard");
  assert.equal(result.guard.decision, "eligible");
  assert.equal(result.guard.eligibleForCallerAuthorization, true);
  assert.equal(result.prepaymentDecision.targetPayment.payTo, payTo);
  assert.equal(result.prepaymentDecision.authorizationBoundary.agentResolverSignsTargetPayment, false);
  assert.equal(result.evidenceReceipt.observedAt, "2026-09-17T22:00:00.000Z");
  assert.equal(result.guard.evidenceDigestSha256, result.evidenceReceipt.evidence.digest);
});

test("AgentResolver Guard fails closed when caller expectations do not match", () => {
  const constraints = {
    expectedPayTo: "0x2222222222222222222222222222222222222222"
  };
  const result = buildX402PaymentGuardResult(report(constraints), constraints);

  assert.equal(result.guard.decision, "blocked");
  assert.equal(result.guard.eligibleForCallerAuthorization, false);
  assert.ok(result.guard.reasonCodes.includes("expected_payto_mismatch"));
});
