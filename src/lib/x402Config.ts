export const X402_PAY_TO = "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8" as const;
export const X402_NETWORK = "eip155:8453" as const;
export const X402_ASSET = "USDC" as const;

// Keep capability discovery free. Monetization is attached only to resources
// that perform paid AgentResolver-owned work. Never gate /api/resolve or MCP
// discovery behind payment.
export const X402_PRICING = {
  premiumResolve: "$0.01",
} as const;

export const X402_POLICY = {
  discoveryFree: true,
  agentSpendingAuthorizedByResolver: false,
  settlementNetwork: "Base",
  settlementAsset: X402_ASSET,
  payTo: X402_PAY_TO,
} as const;
