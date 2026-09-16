import test from "node:test";
import assert from "node:assert/strict";
import { buildProviderEvidenceReceipt } from "../src/lib/providerEvidenceReceipt";

const report = {
  url: "https://merchant.example/api/paid-resource",
  status: 402,
  ok: false,
  latencyMs: 118,
  contentType: "application/json",
  contentLength: null,
  cacheControl: "no-store",
  etag: null,
  lastModified: null,
  location: null,
  server: "example",
  response: { allow: null, vary: null, age: null, contentEncoding: null },
  redirect: { isRedirect: false, location: null },
  dns: { family: 4 as const },
  tls: {
    protocol: "TLSv1.3",
    authorized: true,
    validFrom: "Sep 1 00:00:00 2026 GMT",
    validTo: "Dec 1 00:00:00 2026 GMT",
    daysRemaining: 76,
    subjectCn: "merchant.example",
    issuerCn: "Example CA"
  },
  security: {
    hsts: true,
    csp: true,
    xContentTypeOptions: true,
    xFrameOptions: true,
    referrerPolicy: true,
    permissionsPolicy: true
  },
  x402: {
    detected: true,
    challengeHeaderPresent: true,
    parseable: true,
    version: 2,
    acceptCount: 1,
    scheme: "exact",
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x1111111111111111111111111111111111111111",
    resource: "https://merchant.example/api/paid-resource",
    amountAtomic: "5000",
    amountUsd: 0.005,
    score: 100,
    verdict: "strong" as const,
    checks: [
      { id: "pay_to", label: "Payment recipient declared", passed: true, weight: 5, evidence: "payTo observed." }
    ]
  },
  trust: {
    score: 100,
    infrastructureScore: 100,
    x402Score: 100,
    grade: "A" as const,
    verdict: "strong" as const,
    checks: [
      { id: "tls_authorized", label: "TLS certificate authorized", passed: true, weight: 30, evidence: "Certificate chain authorized." }
    ]
  }
};

test("evidence receipt creates stable observed payment identity fingerprints", () => {
  const first = buildProviderEvidenceReceipt(report, "2026-09-16T18:20:00.000Z");
  const second = buildProviderEvidenceReceipt(report, "2026-09-16T18:25:00.000Z");

  assert.equal(first.observedPaymentIdentity.paymentIdentityFingerprint, second.observedPaymentIdentity.paymentIdentityFingerprint);
  assert.equal(first.observedPaymentIdentity.endpointPaymentFingerprint, second.observedPaymentIdentity.endpointPaymentFingerprint);
  assert.equal(first.observedPaymentTerms.paymentTermsFingerprint, second.observedPaymentTerms.paymentTermsFingerprint);
  assert.equal(first.evidence.digest, second.evidence.digest);
  assert.notEqual(first.observedAt, second.observedAt);
});

test("wallet changes alter observed identity and payment-terms fingerprints", () => {
  const first = buildProviderEvidenceReceipt(report);
  const changed = buildProviderEvidenceReceipt({
    ...report,
    x402: {
      ...report.x402,
      payTo: "0x2222222222222222222222222222222222222222"
    }
  });

  assert.notEqual(
    first.observedPaymentIdentity.paymentIdentityFingerprint,
    changed.observedPaymentIdentity.paymentIdentityFingerprint
  );
  assert.notEqual(
    first.observedPaymentIdentity.endpointPaymentFingerprint,
    changed.observedPaymentIdentity.endpointPaymentFingerprint
  );
  assert.notEqual(
    first.observedPaymentTerms.paymentTermsFingerprint,
    changed.observedPaymentTerms.paymentTermsFingerprint
  );
});

test("evidence receipt does not overclaim legal ownership or legitimacy", () => {
  const receipt = buildProviderEvidenceReceipt(report);

  assert.equal(receipt.observedPaymentIdentity.ownershipVerified, false);
  assert.equal(receipt.observedPaymentIdentity.providerLegitimacyVerified, false);
  assert.ok(receipt.limitations.some((line) => /legal ownership/i.test(line)));
  assert.ok(receipt.limitations.some((line) => /provider legitimacy/i.test(line)));
  assert.equal(receipt.interoperability.erc8004.status, "candidate_evidence_only");
  assert.equal(receipt.interoperability.erc8004.submittedOnchain, false);
  assert.equal(receipt.interoperability.erc8004.identityBinding, null);
  assert.deepEqual(
    receipt.interoperability.erc8004.feedbackCandidates.map((item) => item.tag1),
    ["reachable", "responseTime", "x402ProtocolValid"]
  );
});
