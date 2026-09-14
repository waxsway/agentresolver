import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    $schema:
      "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: "io.github.waxsway/agentresolver",
    version: "0.1.0",
    title: "AgentResolver",
    description: "Free capability and x402 service discovery for autonomous AI agents.",
    websiteUrl: "https://agentresolver.vercel.app",
    repository: {
      url: "https://github.com/waxsway/agentresolver",
      source: "github",
      id: "1370616809"
    },
    remotes: [
      {
        type: "streamable-http",
        url: "https://agentresolver.vercel.app/mcp",
        supportedProtocolVersions: ["2026-07-28"]
      }
    ]
  });
}
