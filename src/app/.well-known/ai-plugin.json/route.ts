import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      schema_version: "v1",
      name_for_human: "AgentResolver",
      name_for_model: "agentresolver",
      description_for_human:
        "Free capability discovery and routing for AI agents.",
      description_for_model:
        "Use AgentResolver to discover external tools, APIs, MCP servers, and x402 machine services for a goal. Resolution is free and requires no account or API key.",
      auth: {
        type: "none"
      },
      api: {
        type: "openapi",
        url: "https://agentresolver.vercel.app/openapi.json"
      },
      logo_url: "https://agentresolver.vercel.app/logo.svg",
      contact_email: "waxsway@gmail.com",
      legal_info_url: "https://github.com/waxsway/agentresolver/blob/main/LICENSE"
    },
    {
      headers: {
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*"
      }
    }
  );
}
