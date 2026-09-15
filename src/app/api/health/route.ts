import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "AgentResolver",
      version: "0.1.1",
      resolver: "/api/resolve",
      mcp: "/mcp",
      registry: "io.github.waxsway/agentresolver"
    },
    {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        "access-control-allow-origin": "*"
      }
    }
  );
}
