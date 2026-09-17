import type { HttpInspectReport } from "@/lib/httpInspect";
import { buildProviderEvidenceReceipt } from "@/lib/providerEvidenceReceipt";
import { buildX402PrepayDecision, type X402PrepayConstraints } from "@/lib/x402PrepayDecision";

export function buildX402PaymentGuardResult(
  report: HttpInspectReport,
  constraints: X402PrepayConstraints = {},
  observedAt?: string
) {
  const evidenceReceipt = buildProviderEvidenceReceipt(report, observedAt);
  const prepaymentDecision = buildX402PrepayDecision(report, evidenceReceipt, constraints);

  return {
    ...report,
    guard: {
      product: "AgentResolver Guard",
      decision: prepaymentDecision.decision,
      eligibleForCallerAuthorization: prepaymentDecision.eligibleForCallerAuthorization,
      reasonCodes: prepaymentDecision.reasons,
      evidenceDigestSha256: evidenceReceipt.evidence.digest,
      paymentIdentityFingerprint: evidenceReceipt.observedPaymentIdentity.paymentIdentityFingerprint,
      paymentTermsFingerprint: evidenceReceipt.observedPaymentTerms.paymentTermsFingerprint
    },
    prepaymentDecision,
    evidenceReceipt
  };
}
