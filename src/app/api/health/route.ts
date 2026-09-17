import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "AgentResolver",
      version: "0.1.4",
      purpose: "GET-first $0.001 USDC non-custodial x402 verify-before-pay Guard with free fallback capability discovery",
      resolver: "/api/resolve",
      mcp: "/mcp",
      serverCard: "/mcp/server-card",
      openapi: "/openapi.json",
      paidManifest: "/.well-known/x402",
      canonicalPaidRoute: "/api/x402-payment-preflight",
      trust: "/.well-known/agentresolver-trust.json",
      evidence: "/.well-known/agentresolver-evidence.json",
      reputation: "/.well-known/agentresolver-reputation.json",
      security: "/.well-known/security.txt",
      legal: "/legal",
      agentGuide: "/agentresolver.md",
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
