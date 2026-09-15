import { NextResponse } from "next/server";
import { CANONICAL_ORIGIN, PAID_CAPABILITY_LIST } from "@/lib/paidCapabilities";

export function GET() {
  const base = CANONICAL_ORIGIN;
  return NextResponse.json({
    name: "agentresolver",
    title: "AgentResolver",
    description: "Free capability discovery plus optional pay-per-call direct utilities, compatibility checks, and live evidence for autonomous agents.",
    version: "0.1.3",
    transport: { type: "streamable-http", url: `${base}/mcp` },
    serverCard: `${base}/mcp/server-card`,
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
    payment: { protocol: "x402", network: "eip155:8453", asset: "USDC", authorization: "caller-policy-required" },
    discovery: {
      llms: `${base}/llms.txt`,
      llmsFull: `${base}/llms-full.txt`,
      skill: `${base}/skill.md`,
      capabilities: `${base}/capabilities.json`,
      ard: `${base}/.well-known/ard.json`,
      aiCatalog: `${base}/.well-known/ai-catalog.json`,
      x402: `${base}/.well-known/x402`
    },
    usageHint: "Use resolve for free discovery. Quote tools never authorize spending; execute a returned x402 action only under the caller's own budget and permission policy."
  }, { headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
}
