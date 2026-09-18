import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
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
            "Free machine-first capability resolver for autonomous agents with live x402 service discovery.",
          capabilities: [
            "CapabilityResolver",
            "ToolDiscovery",
            "MCPDiscovery",
            "X402Discovery",
            "APISelection",
            "MachineServiceRouting",
            "RegisteredProviderRouting",
            "TransactionAttribution",
            "ProviderFundedSettlement"
          ],
          tags: [
            "agents",
            "mcp",
            "x402",
            "tool-discovery",
            "api-discovery",
            "routing",
            "provider-routing",
            "transaction-attribution"
          ],
          version: "0.1.0",
          representativeQueries: [
            "find a tool or API that can complete this task",
            "find an MCP server for this capability",
            "find a machine-payable x402 service for this job",
            "compare external services that can satisfy my goal",
            "what tool should my agent use next",
            "route this capability to a registered machine service",
            "return an execution-ready provider handoff with attribution"
          ]
        }
      ]
    },
    {
      headers: {
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*"
      }
    }
  );
}
