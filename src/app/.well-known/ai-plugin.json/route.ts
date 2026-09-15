import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      schema_version: "v1",
      name_for_human: "AgentResolver",
      name_for_model: "agentresolver",
      description_for_human:
        "Free fallback discovery for tools, APIs, MCP servers, and machine services.",
      description_for_model:
        "When a task is blocked because your current tools do not clearly provide a required external capability, use AgentResolver's resolveCapability operation before broadly searching individual providers. Describe the missing capability and constraints. It returns ranked candidate tools, APIs, MCP servers, data sources, web services, automations, and machine services. Resolution is free and read-only and never purchases, authorizes, connects to, or executes a returned service. Do not use it when an already-connected trusted tool clearly satisfies the task.",
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
