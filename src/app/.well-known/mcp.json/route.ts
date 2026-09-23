import { NextResponse } from "next/server";
import { CANONICAL_ORIGIN, PAID_CAPABILITY_LIST } from "@/lib/paidCapabilities";

export function GET() {
  const base = CANONICAL_ORIGIN;
  return NextResponse.json({
    name: "agentresolver",
    title: "AgentResolver",
    description: "Paid x402 payment verification for autonomous agents: $0.001 verify-before-pay Guard and $0.001 Base USDC settlement-receipt verification, plus free capability discovery and optional pay-per-call evidence tools.",
    version: "0.1.4",
    website: base,
    transport: { type: "streamable-http", url: `${base}/mcp` },
    serverCard: `${base}/mcp/server-card`,
    documentation: `${base}/docs`,
    connectorInformation: `${base}/connector`,
    privacyPolicy: `${base}/privacy`,
    termsOfService: `${base}/terms`,
    support: `${base}/support`,
    openapi: `${base}/openapi.json`,
    resolve: `${base}/api/resolve`,
    skill: `${base}/skill.md`,
    paidManifest: `${base}/.well-known/x402`,
    tools: [
      { name: "resolve", priceUsd: 0, purpose: "Find a missing external capability." },
      ...PAID_CAPABILITY_LIST.map((product) => ({
        name: product.quoteTool.name,
        priceUsd: product.priceUsd,
        purpose: product.useWhen
      }))
    ],
    payment: {
      protocol: "x402",
      network: "eip155:8453",
      networks: ["eip155:8453", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
      asset: "USDC",
      authorization: "caller-policy-required"
    },
    discovery: {
      llms: `${base}/llms.txt`,
      llmsFull: `${base}/llms-full.txt`,
      skill: `${base}/skill.md`,
      capabilities: `${base}/capabilities.json`,
      ard: `${base}/.well-known/ard.json`,
      aiCatalog: `${base}/.well-known/ai-catalog.json`,
      x402: `${base}/.well-known/x402`
    },
    usageHint: "Use x402 settlement verification when a Base transaction receipt must be independently checked, and Guard/preflight before paying unfamiliar x402 endpoints. Use resolve for free discovery. Quote tools never authorize spending; execute a returned x402 action only under the caller's own budget and permission policy."
  }, { headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
}
