import { createHash } from "node:crypto";
import type { HttpInspectReport } from "@/lib/httpInspect";

export const PROVIDER_EVIDENCE_RECEIPT_VERSION = 1;

function sha256(parts: Array<string | number | boolean | null>) {
  return createHash("sha256")
    .update(parts.map((part) => part === null ? "<null>" : String(part)).join("\n"), "utf8")
    .digest("hex");
}

function normalizePaymentValue(network: string | null, value: string | null) {
  if (!value) return null;
  return network?.startsWith("eip155:") ? value.toLowerCase() : value;
}

export type ProviderEvidenceReceipt = ReturnType<typeof buildProviderEvidenceReceipt>;

export function buildProviderEvidenceReceipt(report: HttpInspectReport, observedAt = new Date().toISOString()) {
  const target = new URL(report.url);
  const network = report.x402.network;
  const asset = normalizePaymentValue(network, report.x402.asset);
  const payTo = normalizePaymentValue(network, report.x402.payTo);
  const resource = report.x402.resource;
  const amountAtomic = report.x402.amountAtomic;

  const paymentIdentityFingerprint = network && asset && payTo
    ? sha256(["payment-identity-v1", network, asset, payTo])
    : null;

  const endpointPaymentFingerprint = paymentIdentityFingerprint
    ? sha256(["endpoint-payment-identity-v1", target.origin.toLowerCase(), network, asset, payTo])
    : null;

  const paymentTermsFingerprint = network && asset && payTo && resource && amountAtomic
    ? sha256([
        "payment-terms-v1",
        network,
        asset,
        payTo,
        resource,
        amountAtomic,
        report.x402.scheme,
        report.x402.version
      ])
    : null;

  const evidenceDigest = sha256([
    "agentresolver-evidence-v1",
    report.url,
    report.status,
    report.latencyMs,
    report.tls.authorized,
    report.tls.protocol,
    report.tls.subjectCn,
    report.tls.issuerCn,
    report.x402.detected,
    report.x402.parseable,
    report.x402.version,
    report.x402.scheme,
    network,
    asset,
    payTo,
    resource,
    amountAtomic,
    report.x402.amountUsd,
    report.x402.score,
    report.trust.infrastructureScore,
    report.trust.x402Score
  ]);

  return {
    schemaVersion: PROVIDER_EVIDENCE_RECEIPT_VERSION,
    observedAt,
    source: "live_endpoint_observation" as const,
    endpoint: {
      url: report.url,
      origin: target.origin,
      status: report.status,
      tlsAuthorized: report.tls.authorized,
      tlsProtocol: report.tls.protocol
    },
    observedPaymentIdentity: {
      network,
      asset,
      payTo,
      paymentIdentityFingerprint,
      endpointPaymentFingerprint,
      basis: "x402_challenge" as const,
      ownershipVerified: false,
      providerLegitimacyVerified: false
    },
    observedPaymentTerms: {
      resource,
      amountAtomic,
      amountUsd: report.x402.amountUsd,
      scheme: report.x402.scheme,
      x402Version: report.x402.version,
      paymentTermsFingerprint
    },
    evidence: {
      digestAlgorithm: "sha256" as const,
      digest: evidenceDigest,
      infrastructureScore: report.trust.infrastructureScore,
      x402Score: report.trust.x402Score,
      checksObserved: report.trust.checks.length + report.x402.checks.length
    },
    limitations: [
      "This receipt records what AgentResolver observed at one point in time.",
      "It does not establish legal ownership of the payTo wallet.",
      "It does not certify provider legitimacy, future behavior, or fulfillment.",
      "A technically valid payment challenge can still belong to a malicious or misrepresented provider."
    ]
  };
}
