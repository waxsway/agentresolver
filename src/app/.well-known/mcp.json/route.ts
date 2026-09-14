import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      name: "AgentResolver",
      description:
        "Free capability resolver for AI agents with MCP, API, and x402 service discovery.",
      url: "https://agentresolver.vercel.app/mcp",
      transport: "streamable-http",
      registry: "io.github.waxsway/agentresolver",
      serverCard:
        "https://agentresolver.vercel.app/.well-known/mcp/server-card.json",
      registryCard: "https://agentresolver.vercel.app/mcp/server-card",
      openapi: "https://agentresolver.vercel.app/openapi.json"
    },
    {
      headers: {
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*"
      }
    }
  );
}
