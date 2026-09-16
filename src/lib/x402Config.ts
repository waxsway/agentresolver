import { getPaidCapability } from "@/lib/paidCapabilities";

export const X402_PAY_TO = "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8" as const;
export const X402_SOLANA_PAY_TO = "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa" as const;
export const X402_NETWORK = "eip155:8453" as const;
export const X402_SOLANA_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" as const;
export const X402_ASSET = "USDC" as const;
export const X402_SOLANA_ASSET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" as const;
export const X402_SOLANA_FEE_PAYER = "CjNFTjvBhbJJd2B5ePPMHRLx1ELZpa8dwQgGL727eKww" as const;
export const X402_FACILITATOR_URL = "https://facilitator.payai.network" as const;

// Keep capability discovery free. Monetization is attached only to resources
// that perform paid AgentResolver-owned work. Never gate /api/resolve or MCP
// discovery behind payment.
export const X402_PRICING = {
  hashEncode: getPaidCapability("hash-encode").price,
  httpInspect: getPaidCapability("http-inspect").price,
  toolContract: getPaidCapability("tool-contract").price,
  mcpProbe: getPaidCapability("mcp-probe").price,
  agentReadiness: getPaidCapability("agent-readiness").price,
  openapiSelect: getPaidCapability("openapi-select").price,
  verifiedResolve: getPaidCapability("verified-resolve").price,
  batchVerifiedResolve: getPaidCapability("batch-verified-resolve").price
} as const;

export const X402_POLICY = {
  discoveryFree: true,
  agentSpendingAuthorizedByResolver: false,
  settlementNetworks: ["Base", "Solana"],
  settlementAsset: X402_ASSET,
  facilitator: "payai",
  facilitatorUrl: X402_FACILITATOR_URL,
  payTo: {
    base: X402_PAY_TO,
    solana: X402_SOLANA_PAY_TO
  }
} as const;
