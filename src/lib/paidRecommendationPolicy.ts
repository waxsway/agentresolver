import {
  CANONICAL_ORIGIN,
  getPaidCapability,
  type PaidCapabilityId
} from "@/lib/paidCapabilities";

export const DIRECT_OWNED_CAPABILITY_IDS = new Set<PaidCapabilityId>([
  "x402-payment-preflight",
  "hash-encode",
  "http-inspect",
  "tool-contract",
  "mcp-probe",
  "agent-readiness",
  "openapi-select",
  "verified-resolve",
  "batch-verified-resolve"
]);

export function isDirectOwnedCapabilityId(id: string): id is PaidCapabilityId {
  return DIRECT_OWNED_CAPABILITY_IDS.has(id as PaidCapabilityId);
}

export function directOwnedRecommendationInput(
  capabilityId: PaidCapabilityId,
  goal: string,
  url?: string,
  singleProbeableMcpEndpoint?: string | null
): Record<string, unknown> | undefined {
  if (capabilityId === "x402-payment-preflight" && url) {
    return { url, method: "GET" };
  }
  if (capabilityId === "http-inspect" && url) return { url };
  if (capabilityId === "agent-readiness" && url) return { url };
  if (capabilityId === "mcp-probe" && singleProbeableMcpEndpoint) {
    return { endpoint: singleProbeableMcpEndpoint };
  }
  if (capabilityId === "openapi-select" && url) return { specUrl: url, goal };
  if (capabilityId === "verified-resolve") return { goal, ...(url ? { url } : {}) };
  return undefined;
}

function paidNextAction(
  capabilityId:
    | "x402-payment-preflight"
    | "x402-settlement-verify"
    | "verified-resolve"
    | "batch-verified-resolve"
) {
  const capability = getPaidCapability(capabilityId);
  return {
    capabilityId: capability.id,
    endpoint: `${CANONICAL_ORIGIN}${capability.endpoint}`,
    method: capabilityId === "x402-payment-preflight" || capabilityId === "x402-settlement-verify"
      ? "GET" as const
      : "POST" as const,
    priceUsd: capability.priceUsd,
    useWhen: capability.useWhen,
    inputExample: capability.example
  };
}

/**
 * Machine-readable handoff after the low-cost settlement canary succeeds.
 * The canonical trust product is presented explicitly while preserving the
 * existing single/batch resolver handoffs for compatibility and other buyer needs.
 * None of these entries authorizes or initiates a follow-on payment.
 */
export function postSettlementCanaryNextActions() {
  const preflight = paidNextAction("x402-payment-preflight");
  const settlementVerifyBase = paidNextAction("x402-settlement-verify");
  const settlementVerify = {
    ...settlementVerifyBase,
    transactionHashSource: "Use the Base transaction hash returned in the PAYMENT-RESPONSE header from a settled x402 request.",
    paymentAuthorization: "separate_caller_authorization_required" as const
  };
  const recommended = {
    ...preflight,
    reason: "Your x402 client just proved it can settle and receive paid delivery. Before the next autonomous x402 spend, run this $0.001 preflight against the intended paid endpoint to verify the live recipient, amount, network, asset and resource binding before wallet authorization.",
    repeatUse: "before_each_autonomous_x402_payment" as const,
    paymentAuthorization: "separate_caller_authorization_required" as const
  };
  return {
    catalogUrl: `${CANONICAL_ORIGIN}/.well-known/x402`,
    recommended,
    preflight,
    settlementVerify,
    single: paidNextAction("verified-resolve"),
    batch: paidNextAction("batch-verified-resolve")
  };
}
