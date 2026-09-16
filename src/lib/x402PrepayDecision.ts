import type { HttpInspectReport } from "@/lib/httpInspect";
import type { ProviderEvidenceReceipt } from "@/lib/providerEvidenceReceipt";

export const X402_PREPAY_DECISION_VERSION = 1;

const BASE_NETWORK = "eip155:8453";
const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const SOLANA_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type X402PrepayConstraints = {
  maxPriceUsd?: number;
  expectedPayTo?: string;
  expectedNetwork?: string;
};

function supportedUsdc(network: string | null, asset: string | null) {
  if (network === BASE_NETWORK) return asset?.toLowerCase() === BASE_USDC;
  if (network === SOLANA_NETWORK) return asset === SOLANA_USDC;
  return false;
}

function passed(report: HttpInspectReport, id: string) {
  return report.x402.checks.some((check) => check.id === id && check.passed);
}

export function buildX402PrepayDecision(
  report: HttpInspectReport,
  evidenceReceipt: ProviderEvidenceReceipt,
  constraints: X402PrepayConstraints = {}
) {
  const reasons: string[] = [];

  if (!report.tls.authorized) reasons.push("tls_not_authorized");
  if (report.status !== 402) reasons.push("target_did_not_return_402");
  if (!report.x402.challengeHeaderPresent) reasons.push("payment_required_header_missing");
  if (!report.x402.parseable) reasons.push("payment_required_unparseable");
  if (report.x402.version !== 2) reasons.push("unsupported_x402_version");
  if (report.x402.acceptCount < 1) reasons.push("no_payment_option");
  if (report.x402.scheme !== "exact") reasons.push("unsupported_payment_scheme");
  if (!supportedUsdc(report.x402.network, report.x402.asset)) reasons.push("unsupported_network_or_asset");
  if (!report.x402.payTo) reasons.push("payto_missing");
  if (!report.x402.amountAtomic || !/^\d+$/.test(report.x402.amountAtomic) || BigInt(report.x402.amountAtomic) <= 0n) {
    reasons.push("invalid_payment_amount");
  }
  if (report.x402.amountUsd === null || report.x402.amountUsd <= 0) reasons.push("usd_amount_unavailable");
  if (!passed(report, "resource_binding")) reasons.push("resource_binding_mismatch");

  if (constraints.maxPriceUsd !== undefined && !passed(report, "max_price")) {
    reasons.push("max_price_exceeded_or_unverifiable");
  }
  if (constraints.expectedPayTo && !passed(report, "expected_pay_to")) {
    reasons.push("expected_payto_mismatch");
  }
  if (constraints.expectedNetwork && !passed(report, "expected_network")) {
    reasons.push("expected_network_mismatch");
  }

  const eligibleForCallerAuthorization = reasons.length === 0;
  const targetPayment = {
    network: report.x402.network,
    asset: report.x402.asset,
    payTo: report.x402.payTo,
    resource: report.x402.resource,
    amountAtomic: report.x402.amountAtomic,
    amountUsd: report.x402.amountUsd,
    scheme: report.x402.scheme,
    x402Version: report.x402.version
  };

  return {
    schemaVersion: X402_PREPAY_DECISION_VERSION,
    kind: "x402-prepayment-decision" as const,
    decision: eligibleForCallerAuthorization ? "eligible" as const : "blocked" as const,
    eligibleForCallerAuthorization,
    authorizationBoundary: {
      callerMustAuthorizeTargetPayment: true,
      agentResolverSignsTargetPayment: false,
      agentResolverCustodiesOrForwardsTargetFunds: false
    },
    reasons,
    targetPayment,
    constraintsApplied: {
      maxPriceUsd: constraints.maxPriceUsd ?? null,
      expectedPayTo: constraints.expectedPayTo ?? null,
      expectedNetwork: constraints.expectedNetwork ?? null
    },
    evidence: {
      observedAt: evidenceReceipt.observedAt,
      evidenceDigestSha256: evidenceReceipt.evidence.digest,
      paymentIdentityFingerprint: evidenceReceipt.observedPaymentIdentity.paymentIdentityFingerprint,
      endpointPaymentFingerprint: evidenceReceipt.observedPaymentIdentity.endpointPaymentFingerprint,
      paymentTermsFingerprint: evidenceReceipt.observedPaymentTerms.paymentTermsFingerprint
    },
    nextAction: eligibleForCallerAuthorization
      ? {
          type: "caller_may_authorize_exact_target_payment" as const,
          instruction: "If the caller independently chooses to spend, authorize only the exact targetPayment terms returned here."
        }
      : {
          type: "do_not_authorize_target_payment" as const,
          instruction: "Do not authorize the target payment from this observation. Resolve the listed reason codes and preflight again."
        },
    limitations: [
      "Eligibility means the observed technical payment terms passed this fail-closed preflight; it is not spending authorization.",
      "AgentResolver does not establish provider identity, legitimacy, future behavior, or fulfillment.",
      "This is point-in-time evidence and should be refreshed if payment terms change."
    ]
  };
}
