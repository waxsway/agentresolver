import { NextResponse } from "next/server";

export function GET() {
  const base = "https://agentresolver.vercel.app";
  return NextResponse.json({
    name: "agentresolver",
    title: "AgentResolver",
    description: "Free capability discovery plus optional tiny paid live-evidence utilities for autonomous agents.",
    version: "0.1.3",
    transport: { type: "streamable-http", url: `${base}/mcp` },
    serverCard: `${base}/mcp/server-card`,
    openapi: `${base}/openapi.json`,
    resolve: `${base}/api/resolve`,
    paidManifest: `${base}/.well-known/x402`,
    tools: [
      { name: "resolve", priceUsd: 0, purpose: "Find a missing external capability." },
      { name: "mcp_preflight", priceUsd: 0.001, purpose: "Verify one MCP endpoint is live and inspect its current tools." },
      { name: "agent_readiness", priceUsd: 0.005, purpose: "Audit a website for agent discoverability and integration signals." },
      { name: "verified_resolve", priceUsd: 0.02, purpose: "Resolve and live-check top MCP candidates before choosing." },
      { name: "batch_verified_resolve", priceUsd: 0.05, purpose: "Resolve and live-check 2–4 capability decisions in one batch." }
    ],
    payment: { protocol: "x402", network: "eip155:8453", asset: "USDC", authorization: "caller-policy-required" },
    discovery: {
      llms: `${base}/llms.txt`,
      llmsFull: `${base}/llms-full.txt`,
      capabilities: `${base}/capabilities.json`,
      ard: `${base}/.well-known/ard.json`,
      aiCatalog: `${base}/.well-known/ai-catalog.json`,
      x402: `${base}/.well-known/x402`
    },
    usageHint: "Use resolve for free discovery. Use a priced quote tool only when live evidence is useful. Quote tools never authorize spending; execute the returned x402 action only under the caller's own budget and permission policy."
  }, { headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
}
