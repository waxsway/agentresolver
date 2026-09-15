import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { resolveGoal } from "@/lib/resolver";
import { getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import { inspectHttpResource } from "@/lib/httpInspect";
import { createLazyPaidMcpTool } from "@/lib/mcpPayments";
import { evaluateToolContract } from "@/lib/toolContract";
import { selectOpenApiOperation } from "@/lib/openapiSelect";
import { probeMcpEndpoint } from "@/lib/mcpProbe";
import { auditAgentReadiness } from "@/lib/agentReadiness";
import { verifiedResolve } from "@/lib/verifiedResolve";
import { batchVerifiedResolve } from "@/lib/batchVerifiedResolve";
import { callerHash, classifyIntent, safeUserAgent, shortHash } from "@/lib/telemetry";

const CANONICAL = "https://agentresolver.vercel.app";
const paid = (capabilityId: PaidCapabilityId, input: Record<string, unknown>) => {
  const product = getPaidCapability(capabilityId);
  return {
    capabilityId,
    method: "POST",
    execute: `${CANONICAL}${product.endpoint}`,
    input,
    priceUsd: product.priceUsd,
    asset: "USDC",
    network: "eip155:8453",
    protocol: "x402",
    spendingAuthorizationRequired: true,
    spendingAuthorized: false
  };
};

const httpInspectProduct = getPaidCapability("http-inspect");
const toolContractProduct = getPaidCapability("tool-contract");
const mcpProbeProduct = getPaidCapability("mcp-probe");
const readinessProduct = getPaidCapability("agent-readiness");
const openApiSelectProduct = getPaidCapability("openapi-select");
const verifiedResolveProduct = getPaidCapability("verified-resolve");
const batchVerifiedResolveProduct = getPaidCapability("batch-verified-resolve");
function formatUsd(value: number) { return value < 0.01 ? value.toFixed(3) : value.toFixed(2); }
function logToolCall(tool: string, extra: Record<string, unknown> = {}) { console.log(JSON.stringify({ event: "mcp_tool_call", tool, at: new Date().toISOString(), ...extra })); }
async function logMcpRequest(req: Request) {
  const base = { event: "mcp_request", at: new Date().toISOString(), callerHash: callerHash(req), userAgent: safeUserAgent(req) };
  try {
    const body = (await req.clone().json()) as {
      method?: unknown;
      params?: {
        name?: unknown;
        arguments?: { goal?: unknown } | null;
        _meta?: Record<string, unknown> | null;
      } | null;
    };
    const method = typeof body?.method === "string" ? body.method : "unknown";
    const tool = method === "tools/call" && typeof body?.params?.name === "string" ? body.params.name : null;
    const goal = method === "tools/call" && tool === "resolve" && typeof body?.params?.arguments?.goal === "string"
      ? body.params.arguments.goal.trim()
      : "";
    const hasMcpPayment = Boolean(body?.params?._meta?.["x402/payment"]);
    console.log(JSON.stringify({
      ...base,
      method,
      tool,
      hasMcpPayment,
      phase: tool ? (hasMcpPayment ? "paid_retry" : "tool_call") : null,
      ...(goal ? { goalHash: shortHash(goal), goalLength: goal.length, intentTags: classifyIntent(goal) } : {})
    }));
  } catch {
    console.log(JSON.stringify({ ...base, method: "unparsed", tool: null, hasMcpPayment: false }));
  }
}

const handler = createMcpHandler(() => {
  const server = new McpServer({ name: "agentresolver", version: "0.1.3" }, {
    instructions: "AgentResolver is a machine-first capability discovery and paid execution service. Use `resolve` for free whenever an external capability is missing. Every priced MCP tool is directly payable with x402: an x402-aware client can receive the payment challenge, apply its own spending policy, and retry the same tools/call with payment. Existing HTTP x402 endpoints remain available as fallback. Never spend unless the calling host independently authorizes the displayed USDC/Base price."
  });

  server.registerTool("resolve", {
    title: "Resolve a missing capability", description: "Free default discovery. Find ranked tools, APIs, MCP servers and machine services, with a prefilled paid live-evidence action when useful.",
    inputSchema: z.object({ goal: z.string().min(1), url: z.string().url().optional(), limit: z.number().int().min(1).max(10).optional() }),
    annotations: { title: "Resolve a missing capability", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async ({ goal, url, limit }) => {
    const resolution = await resolveGoal(goal, url, limit || 3);
    const candidateCount = resolution.mcp.length + resolution.marketplace.length;
    const singleMcp = resolution.mcp.length === 1 && candidateCount === 1 ? resolution.mcp[0] : null;
    const singleMcpEndpoint = singleMcp && typeof singleMcp.endpoint === "string" && /^https?:\/\//i.test(singleMcp.endpoint) ? singleMcp.endpoint : null;
    const rec = singleMcpEndpoint ? { ...paid("mcp-probe", { endpoint: singleMcpEndpoint }), reason: "One MCP candidate found; live-preflight it before depending on it." }
      : resolution.mcp.length > 0 || candidateCount > 1 ? { ...paid("verified-resolve", { goal, ...(url ? { url } : {}) }), reason: "Candidates found; add live comparative evidence before choosing." } : null;
    logToolCall("resolve", { goalHash: shortHash(goal), goalLength: goal.length, intentTags: classifyIntent(goal), mcpMatches: resolution.mcp.length, marketplaceMatches: resolution.marketplace.length, paidRecommendationShown: Boolean(rec), paidRecommendationCapability: rec?.capabilityId || null });
    if (rec) console.log(JSON.stringify({ event: "paid_recommendation_shown", surface: "mcp", at: new Date().toISOString(), capabilityId: rec.capabilityId, priceUsd: rec.priceUsd, goalHash: shortHash(goal) }));
    const owned = resolution.owned.map((match) => ({ ...match, execute: match.status === "live" && match.endpoint ? `${CANONICAL}${match.endpoint}` : null, spendingAuthorizationRequired: match.priceUsd > 0 }));
    const output = { goal, url: url || null, free: true, readOnly: true, spendingAuthorized: false, owned, mcp: resolution.mcp, marketplace: resolution.marketplace, recommendedPaidAction: rec,
      nextAction: rec ? `Optional live evidence costs $${formatUsd(rec.priceUsd)} USDC on Base. The executable request is prefilled. Execute only if your existing spending policy independently authorizes it.` : "Choose the best relevant result; refine the goal and resolve again if needed.",
      rediscovery: { mcp: `${CANONICAL}/mcp`, resolver: `${CANONICAL}/api/resolve`, paidManifest: `${CANONICAL}/.well-known/x402` } };
    return { content: [{ type: "text", text: JSON.stringify(output) }], structuredContent: output };
  });

  server.registerTool("http_inspect", {
    title: httpInspectProduct.quoteTool.title,
    description: httpInspectProduct.quoteTool.description,
    inputSchema: z.object({ url: z.string().url() }),
    annotations: { title: httpInspectProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, createLazyPaidMcpTool<{ url: string }>("http-inspect", async ({ url }) => {
    logToolCall("http_inspect", { priceUsd: httpInspectProduct.priceUsd, mode: "direct_paid_mcp" });
    const report = await inspectHttpResource(url);
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "http-inspect",
      surface: "mcp",
      at: new Date().toISOString(),
      status: report.status,
      latencyMs: report.latencyMs
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(report) }],
      structuredContent: report
    };
  }));

  server.registerTool("tool_contract", {
    title: toolContractProduct.quoteTool.title,
    description: toolContractProduct.quoteTool.description,
    inputSchema: z.object({
      producerOutputSchema: z.record(z.string(), z.unknown()),
      consumerInputSchema: z.record(z.string(), z.unknown())
    }),
    annotations: { title: toolContractProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{
    producerOutputSchema: Record<string, unknown>;
    consumerInputSchema: Record<string, unknown>;
  }>("tool-contract", async ({ producerOutputSchema, consumerInputSchema }) => {
    logToolCall("tool_contract", { priceUsd: toolContractProduct.priceUsd, mode: "direct_paid_mcp" });
    const report = evaluateToolContract(producerOutputSchema, consumerInputSchema);
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "tool-contract",
      surface: "mcp",
      at: new Date().toISOString(),
      verdict: report.verdict,
      mappingCount: report.normalizedMappings.length
    }));
    return { content: [{ type: "text", text: JSON.stringify(report) }], structuredContent: report };
  }));

  server.registerTool("openapi_select", {
    title: openApiSelectProduct.quoteTool.title,
    description: openApiSelectProduct.quoteTool.description,
    inputSchema: z.object({
      specUrl: z.string().url(),
      goal: z.string().min(1).max(600)
    }),
    annotations: { title: openApiSelectProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, createLazyPaidMcpTool<{ specUrl: string; goal: string }>("openapi-select", async ({ specUrl, goal }) => {
    logToolCall("openapi_select", { priceUsd: openApiSelectProduct.priceUsd, mode: "direct_paid_mcp", goalHash: shortHash(goal) });
    const report = await selectOpenApiOperation(specUrl, goal);
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "openapi-select",
      surface: "mcp",
      at: new Date().toISOString(),
      operationCount: report.api.operationCount,
      confidence: report.confidence,
      selectedOperationId: report.selected?.operationId || null
    }));
    return { content: [{ type: "text", text: JSON.stringify(report) }], structuredContent: report };
  }));

  server.registerTool("mcp_preflight", {
    title: mcpProbeProduct.quoteTool.title, description: mcpProbeProduct.quoteTool.description,
    inputSchema: z.object({ endpoint: z.string().url() }), annotations: { title: mcpProbeProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, createLazyPaidMcpTool<{ endpoint: string }>("mcp-probe", async ({ endpoint }) => {
    logToolCall("mcp_preflight", { priceUsd: mcpProbeProduct.priceUsd, mode: "direct_paid_mcp" });
    const report = await probeMcpEndpoint(endpoint);
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "mcp-probe",
      surface: "mcp",
      at: new Date().toISOString(),
      reachable: report.reachable,
      mcpCompatible: report.mcpCompatible,
      toolCount: report.tools.count
    }));
    return { content: [{ type: "text", text: JSON.stringify(report) }], structuredContent: report };
  }));

  server.registerTool("agent_readiness", {
    title: readinessProduct.quoteTool.title, description: readinessProduct.quoteTool.description,
    inputSchema: z.object({ url: z.string().url() }), annotations: { title: readinessProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, createLazyPaidMcpTool<{ url: string }>("agent-readiness", async ({ url }) => {
    logToolCall("agent_readiness", { priceUsd: readinessProduct.priceUsd, mode: "direct_paid_mcp" });
    const report = await auditAgentReadiness(url);
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "agent-readiness",
      surface: "mcp",
      at: new Date().toISOString(),
      score: report.score,
      grade: report.grade,
      issueCount: report.issues.length
    }));
    return { content: [{ type: "text", text: JSON.stringify(report) }], structuredContent: report };
  }));

  server.registerTool("verified_resolve", {
    title: verifiedResolveProduct.quoteTool.title, description: verifiedResolveProduct.quoteTool.description,
    inputSchema: z.object({ goal: z.string().min(1), url: z.string().url().optional() }), annotations: { title: verifiedResolveProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, createLazyPaidMcpTool<{ goal: string; url?: string }>("verified-resolve", async ({ goal, url }) => {
    logToolCall("verified_resolve", { goalHash: shortHash(goal), priceUsd: verifiedResolveProduct.priceUsd, mode: "direct_paid_mcp" });
    const report = await verifiedResolve(goal, url);
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "verified-resolve",
      surface: "mcp",
      at: new Date().toISOString(),
      mcpVerified: report.liveVerification.filter((item) => item.mcpCompatible).length,
      marketplaceVerified: report.liveMarketplaceVerification.filter((item) => item.x402Compatible).length
    }));
    return { content: [{ type: "text", text: JSON.stringify(report) }], structuredContent: report };
  }));

  server.registerTool("batch_verified_resolve", {
    title: batchVerifiedResolveProduct.quoteTool.title, description: batchVerifiedResolveProduct.quoteTool.description,
    inputSchema: z.object({ items: z.array(z.object({ goal: z.string().min(1), url: z.string().url().optional() })).min(2).max(4) }), annotations: { title: batchVerifiedResolveProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, createLazyPaidMcpTool<{ items: Array<{ goal: string; url?: string }> }>("batch-verified-resolve", async ({ items }) => {
    logToolCall("batch_verified_resolve", { itemCount: items.length, priceUsd: batchVerifiedResolveProduct.priceUsd, mode: "direct_paid_mcp" });
    const report = await batchVerifiedResolve(items);
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "batch-verified-resolve",
      surface: "mcp",
      at: new Date().toISOString(),
      itemCount: report.count
    }));
    return { content: [{ type: "text", text: JSON.stringify(report) }], structuredContent: report };
  }));

  return server;
});
export async function POST(req: Request) { await logMcpRequest(req); return handler.fetch(req); }
export async function GET(req: Request) { return handler.fetch(req); }
export async function DELETE(req: Request) { return handler.fetch(req); }
export async function HEAD() { return new Response(null, { status: 200, headers: { "cache-control": "public, max-age=60" } }); }
