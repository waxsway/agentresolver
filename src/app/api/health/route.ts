import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const cdpCapabilities = new Set(
    (process.env.AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES || "x402-ping")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const cdpFacilitatorEnabledForX402Ping =
    process.env.AGENTRESOLVER_CDP_FACILITATOR_ENABLED === "1" &&
    cdpCapabilities.has("x402-ping");
  const circleGatewayEnabled = process.env.AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED === "1";

  return NextResponse.json(
    {
      ok: true,
      service: "AgentResolver",
      version: "0.1.4",
      purpose: "GET-first $0.001 USDC non-custodial x402 verify-before-pay Guard with free fallback capability discovery",
      resolver: "/api/resolve",
      providerNetwork: "/api/providers",
      transactionRouter: "/api/execute",
      providerAttributionSettlement: "/api/provider-attribution-settle",
      providerLaunchCheck: "/api/provider-launch-check",
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
      registry: "io.github.waxsway/agentresolver",
      paymentRails: {
        default: "payai",
        x402Ping: cdpFacilitatorEnabledForX402Ping ? "coinbase-cdp" : "payai",
        x402PingBase: cdpFacilitatorEnabledForX402Ping ? "coinbase-cdp" : "payai",
        x402PingSolana: "payai",
        cdpFacilitatorEnabledForX402Ping,
        circleGatewayEnabled
      }
    },
    {
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "access-control-allow-origin": "*"
      }
    }
  );
}
