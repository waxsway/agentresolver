import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const AGENT_CARD = {
  protocolVersion: "0.3.0",
  name: "AgentResolver",
  description:
    "Non-custodial payment-safety and capability-verification agent. Discover AgentResolver Guard to verify an x402 payment before signing, or Verified Resolve to procure and live-verify a paid capability. Canonical paid execution settles directly to AgentResolver over x402 USDC; this A2A endpoint is free discovery/handoff only.",
  version: "0.1.0",
  url: "https://agentresolver.vercel.app/a2a",
  preferredTransport: "JSONRPC",
  capabilities: {
    streaming: false,
    pushNotifications: false,
  },
  defaultInputModes: ["text/plain", "application/json"],
  defaultOutputModes: ["text/plain", "application/json"],
  skills: [
    {
      id: "verify_x402_before_paying",
      name: "Verify x402 Payment Before Paying",
      description:
        "Use AgentResolver Guard immediately before an autonomous wallet signs a target x402 payment. Paid execution is $0.001 USDC per Guard call on Base or Solana and returns an eligible/blocked decision plus observed amount, asset, network, payTo, scheme, resource binding and evidence.",
      tags: ["x402", "payment", "preflight", "wallet-safety", "verification"],
      examples: [
        "Verify this x402 endpoint before I pay it.",
        "Check the payTo, amount, asset and network before signing.",
      ],
    },
    {
      id: "procure_verified_capability",
      name: "Procure and Verify a Paid Capability",
      description:
        "Use Verified Resolve to find a missing agent capability and live-verify supported MCP/x402 candidates before recommending one. Paid execution is $0.02 USDC per request.",
      tags: ["agent", "procurement", "mcp", "x402", "verification"],
      examples: [
        "Find and verify a paid web search capability.",
        "Procure an x402 service under my price ceiling.",
      ],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
} as const;

export async function GET() {
  return NextResponse.json(AGENT_CARD, {
    headers: {
      "cache-control": "public, max-age=300",
    },
  });
}
