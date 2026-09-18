import { NextResponse } from "next/server";

export const dynamic = "force-static";

function cdpCapabilitySet() {
  const configured = process.env.AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES?.trim();
  return new Set((configured || "x402-ping").split(",").map((value) => value.trim()).filter(Boolean));
}

function configuredPaymentRail(capabilityId: string) {
  return process.env.AGENTRESOLVER_CDP_FACILITATOR_ENABLED === "1" &&
    cdpCapabilitySet().has(capabilityId)
    ? "coinbase-cdp"
    : "payai";
}

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
      configuredPaymentRails: {
        x402Ping: configuredPaymentRail("x402-ping"),
        x402PaymentPreflight: configuredPaymentRail("x402-payment-preflight"),
        circleGatewayEnabled: process.env.AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED === "1"
      },
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
