import { NextResponse } from "next/server";

const catalog = {
  specVersion: "1.0",
  host: {
    displayName: "AgentResolver",
    identifier: "agentresolver.vercel.app",
    documentationUrl: "https://agentresolver.vercel.app"
  },
  entries: [
    {
      identifier: "urn:air:agentresolver.vercel.app:mcp:agentresolver",
      displayName: "AgentResolver",
      type: "application/mcp-server-card+json",
      url: "https://agentresolver.vercel.app/mcp/server-card",
      description:
        "Paid x402 payment-verification infrastructure for autonomous agents: $0.001 verify-before-pay checks and $0.001 Base USDC settlement-receipt verification, plus free capability discovery.",
      capabilities: [
        "CapabilityResolver",
        "ToolDiscovery",
        "MCPDiscovery",
        "X402Discovery",
        "APISelection",
        "MachineServiceRouting",
        "X402PaymentPreflight",
        "X402SettlementVerification",
        "PaymentReceiptVerification"
      ],
      tags: [
        "agents",
        "mcp",
        "x402",
        "tool-discovery",
        "api-discovery",
        "routing",
        "payment-verification",
        "settlement-receipt",
        "transaction-verification"
      ],
      version: "0.1.0",
      representativeQueries: [
        "find a tool or API that can complete this task",
        "find an MCP server for this capability",
        "find a machine-payable x402 service for this job",
        "compare external services that can satisfy my goal",
        "what tool should my agent use next",
        "verify an x402 settlement receipt from a Base transaction hash",
        "verify a Base USDC x402 payment recipient and amount",
        "check an x402 endpoint before paying it"
      ]
    }
  ]
};

export function GET() {
  return NextResponse.json(catalog, {
    headers: {
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*"
    }
  });
}
