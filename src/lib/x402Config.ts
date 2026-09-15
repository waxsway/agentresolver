export const X402_PAY_TO = "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8" as const;
export const X402_NETWORK = "eip155:8453" as const;
export const X402_ASSET = "USDC" as const;
export const X402_FACILITATOR_URL = "https://facilitator.xpay.sh" as const;

// Keep capability discovery free. Monetization is attached only to resources
// that perform paid AgentResolver-owned work. Never gate /api/resolve or MCP
// discovery behind payment.
export const X402_PRICING = {
  httpInspect: "$0.001",
  mcpProbe: "$0.001",
  agentReadiness: "$0.005",
  verifiedResolve: "$0.02",
  batchVerifiedResolve: "$0.05"
} as const;

export const X402_POLICY = {
  discoveryFree: true,
  agentSpendingAuthorizedByResolver: false,
  settlementNetwork: "Base",
  settlementAsset: X402_ASSET,
  facilitator: "xpay",
  facilitatorUrl: X402_FACILITATOR_URL,
  payTo: X402_PAY_TO
} as const;
