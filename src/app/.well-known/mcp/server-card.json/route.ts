import { NextResponse } from "next/server";

const quoteAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export function GET() {
  return NextResponse.json({
    serverInfo: { name: "AgentResolver", version: "0.1.3" },
    authentication: { required: false, schemes: [] },
    instructions: "Use resolve for free missing-capability discovery. The four quote tools return exact x402 purchase actions but never authorize or initiate spending.",
    tools: [
      {
        name: "resolve",
        description: "Free universal capability resolver for external tools, APIs, MCP servers, and x402 services.",
        inputSchema: { type: "object", properties: { goal: { type: "string" }, url: { type: "string", format: "uri" }, limit: { type: "integer", minimum: 1, maximum: 10, default: 3 } }, required: ["goal"] },
        annotations: quoteAnnotations
      },
      {
        name: "mcp_preflight",
        description: "Quote a $0.001 USDC/Base live MCP endpoint preflight. Returns the exact x402 action; does not spend.",
        inputSchema: { type: "object", properties: { endpoint: { type: "string", format: "uri" } }, required: ["endpoint"] }, annotations: quoteAnnotations
      },
      {
        name: "agent_readiness",
        description: "Quote a $0.005 USDC/Base website agent-readiness audit. Returns the exact x402 action; does not spend.",
        inputSchema: { type: "object", properties: { url: { type: "string", format: "uri" } }, required: ["url"] }, annotations: quoteAnnotations
      },
      {
        name: "verified_resolve",
        description: "Quote a $0.02 USDC/Base resolve plus live verification of top MCP candidates. Returns the exact x402 action; does not spend.",
        inputSchema: { type: "object", properties: { goal: { type: "string" }, url: { type: "string", format: "uri" } }, required: ["goal"] }, annotations: quoteAnnotations
      },
      {
        name: "batch_verified_resolve",
        description: "Quote a $0.05 USDC/Base batch live verification for 2–4 capability decisions. Returns the exact x402 action; does not spend.",
        inputSchema: { type: "object", properties: { items: { type: "array", minItems: 2, maxItems: 4, items: { type: "object", properties: { goal: { type: "string" }, url: { type: "string", format: "uri" } }, required: ["goal"] } } }, required: ["items"] }, annotations: quoteAnnotations
      }
    ],
    resources: [], prompts: [],
    payment: { manifest: "https://agentresolver.vercel.app/.well-known/x402", protocol: "x402", network: "eip155:8453", asset: "USDC" }
  }, { headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
}
