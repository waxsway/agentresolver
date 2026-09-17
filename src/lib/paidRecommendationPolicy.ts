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
    | "verified-resolve"
    | "batch-verified-resolve"
) {
  const capability = getPaidCapability(capabilityId);
  return {
    capabilityId: capability.id,
    endpoint: `${CANONICAL_ORIGIN}${capability.endpoint}`,
    method: "POST" as const,
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
  return {
    catalogUrl: `${CANONICAL_ORIGIN}/.well-known/x402`,
    preflight: paidNextAction("x402-payment-preflight"),
    single: paidNextAction("verified-resolve"),
    batch: paidNextAction("batch-verified-resolve")
  };
}
