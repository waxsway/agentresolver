import { getPaidCapability } from "@/lib/paidCapabilities";

export const X402_PAY_TO = "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8" as const;
export const X402_NETWORK = "eip155:8453" as const;
export const X402_ASSET = "USDC" as const;
export const X402_FACILITATOR_URL = "https://facilitator.xpay.sh" as const;

// Keep static discovery metadata free, but meter goal-specific resolution and
// all AgentResolver-owned execution. Crawlers can inspect capabilities without
// causing paid work; useful goal-specific output crosses x402.
export const X402_PRICING = {
  resolve: getPaidCapability("resolve").price,
  httpInspect: getPaidCapability("http-inspect").price,
  toolContract: getPaidCapability("tool-contract").price,
  mcpProbe: getPaidCapability("mcp-probe").price,
  agentReadiness: getPaidCapability("agent-readiness").price,
  openapiSelect: getPaidCapability("openapi-select").price,
  verifiedResolve: getPaidCapability("verified-resolve").price,
  batchVerifiedResolve: getPaidCapability("batch-verified-resolve").price
} as const;

export const X402_POLICY = {
  discoveryFree: false,
  agentSpendingAuthorizedByResolver: false,
  settlementNetwork: "Base",
  settlementAsset: X402_ASSET,
  facilitator: "xpay",
  facilitatorUrl: X402_FACILITATOR_URL,
  payTo: X402_PAY_TO
} as const;
