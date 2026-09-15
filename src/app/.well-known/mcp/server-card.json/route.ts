import { NextResponse } from "next/server";
import { PAID_CAPABILITY_LIST } from "@/lib/paidCapabilities";

const quoteAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export function GET() {
  return NextResponse.json({
    serverInfo: { name: "AgentResolver", version: "0.1.3" },
    authentication: { required: false, schemes: [] },
    instructions: "Use resolve for free missing-capability discovery. Paid quote tools return exact x402 purchase actions but never authorize or initiate spending.",
    tools: [
      {
        name: "resolve",
        description: "Free universal capability resolver for external tools, APIs, MCP servers, and x402 services.",
        inputSchema: { type: "object", properties: { goal: { type: "string" }, url: { type: "string", format: "uri" }, limit: { type: "integer", minimum: 1, maximum: 10, default: 3 } }, required: ["goal"] },
        annotations: quoteAnnotations
      },
      ...PAID_CAPABILITY_LIST.map((product) => ({
        name: product.quoteTool.name,
        description: product.quoteTool.description,
        inputSchema: product.inputSchema,
        annotations: { ...quoteAnnotations, title: product.quoteTool.title, openWorldHint: product.costClass !== "deterministic" }
      }))
    ],
    resources: [],
    prompts: [],
    payment: { manifest: "https://agentresolver.vercel.app/.well-known/x402", protocol: "x402", network: "eip155:8453", asset: "USDC" }
  }, { headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
}
