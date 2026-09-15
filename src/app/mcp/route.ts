import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { resolveGoal } from "@/lib/resolver";
import { callerHash, classifyIntent, safeUserAgent, shortHash } from "@/lib/telemetry";

const CANONICAL = "https://agentresolver.vercel.app";
const paid = (capabilityId: string, endpoint: string, priceUsd: number, input: Record<string, unknown>) => ({
  capabilityId, method: "POST", execute: `${CANONICAL}${endpoint}`, input, priceUsd, asset: "USDC", network: "eip155:8453", protocol: "x402", spendingAuthorizationRequired: true, spendingAuthorized: false
});
function formatUsd(value: number) { return value < 0.01 ? value.toFixed(3) : value.toFixed(2); }
function logToolCall(tool: string, extra: Record<string, unknown> = {}) { console.log(JSON.stringify({ event: "mcp_tool_call", tool, at: new Date().toISOString(), ...extra })); }
async function logMcpRequest(req: Request) {
  const base = { event: "mcp_request", at: new Date().toISOString(), callerHash: callerHash(req), userAgent: safeUserAgent(req) };
  try {
    const body = (await req.clone().json()) as { method?: unknown; params?: { name?: unknown; arguments?: { goal?: unknown } | null } | null };
    const method = typeof body?.method === "string" ? body.method : "unknown";
    const tool = method === "tools/call" && typeof body?.params?.name === "string" ? body.params.name : null;
    const goal = method === "tools/call" && tool === "resolve" && typeof body?.params?.arguments?.goal === "string" ? body.params.arguments.goal.trim() : "";
    console.log(JSON.stringify({ ...base, method, tool, ...(goal ? { goalHash: shortHash(goal), goalLength: goal.length, intentTags: classifyIntent(goal) } : {}) }));
  } catch { console.log(JSON.stringify({ ...base, method: "unparsed", tool: null })); }
}

const handler = createMcpHandler(() => {
  const server = new McpServer({ name: "agentresolver", version: "0.1.3" }, {
    instructions: "AgentResolver is a machine-first capability discovery and live-evidence service. Use `resolve` for free whenever an external capability is missing. For direct verification tasks, call the matching quote tool: `mcp_preflight`, `agent_readiness`, `verified_resolve`, or `batch_verified_resolve`. Quote tools are free/read-only: they return an exact executable x402 action and never spend. If your host independently authorizes the displayed USDC/Base price, execute that returned action; otherwise stop."
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
    const rec = singleMcpEndpoint ? { ...paid("mcp-probe", "/api/mcp-probe", 0.001, { endpoint: singleMcpEndpoint }), reason: "One MCP candidate found; live-preflight it before depending on it." }
      : resolution.mcp.length > 0 || candidateCount > 1 ? { ...paid("verified-resolve", "/api/verified-resolve", 0.02, { goal, ...(url ? { url } : {}) }), reason: "Candidates found; add live comparative evidence before choosing." } : null;
    logToolCall("resolve", { goalHash: shortHash(goal), goalLength: goal.length, intentTags: classifyIntent(goal), mcpMatches: resolution.mcp.length, marketplaceMatches: resolution.marketplace.length, paidRecommendationShown: Boolean(rec), paidRecommendationCapability: rec?.capabilityId || null });
    if (rec) console.log(JSON.stringify({ event: "paid_recommendation_shown", surface: "mcp", at: new Date().toISOString(), capabilityId: rec.capabilityId, priceUsd: rec.priceUsd, goalHash: shortHash(goal) }));
    const owned = resolution.owned.map((match) => ({ ...match, execute: match.status === "live" && match.endpoint ? `${CANONICAL}${match.endpoint}` : null, spendingAuthorizationRequired: match.priceUsd > 0 }));
    const output = { goal, url: url || null, free: true, readOnly: true, spendingAuthorized: false, owned, mcp: resolution.mcp, marketplace: resolution.marketplace, recommendedPaidAction: rec,
      nextAction: rec ? `Optional live evidence costs $${formatUsd(rec.priceUsd)} USDC on Base. The executable request is prefilled. Execute only if your existing spending policy independently authorizes it.` : "Choose the best relevant result; refine the goal and resolve again if needed.",
      rediscovery: { mcp: `${CANONICAL}/mcp`, resolver: `${CANONICAL}/api/resolve`, paidManifest: `${CANONICAL}/.well-known/x402` } };
    return { content: [{ type: "text", text: JSON.stringify(output) }], structuredContent: output };
  });

  server.registerTool("mcp_preflight", {
    title: "Quote MCP live preflight — $0.001", description: "Use when you already have a public MCP HTTP endpoint and need current liveness, compatibility, latency, server metadata and tool inventory. Returns a prefilled $0.001 USDC/Base x402 action; this tool itself never spends.",
    inputSchema: z.object({ endpoint: z.string().url() }), annotations: { title: "Quote MCP live preflight — $0.001", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async ({ endpoint }) => { logToolCall("mcp_preflight", { quotedPriceUsd: 0.001 }); const action = paid("mcp-probe", "/api/mcp-probe", 0.001, { endpoint }); return { content: [{ type: "text", text: JSON.stringify(action) }], structuredContent: action }; });

  server.registerTool("agent_readiness", {
    title: "Quote agent-readiness audit — $0.005", description: "Use to audit a public website for agent discovery/integration signals such as machine-readable metadata, OpenAPI, MCP and crawler readiness. Returns a prefilled $0.005 USDC/Base x402 action; never spends.",
    inputSchema: z.object({ url: z.string().url() }), annotations: { title: "Quote agent-readiness audit — $0.005", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async ({ url }) => { logToolCall("agent_readiness", { quotedPriceUsd: 0.005 }); const action = paid("agent-readiness", "/api/agent-readiness", 0.005, { url }); return { content: [{ type: "text", text: JSON.stringify(action) }], structuredContent: action }; });

  server.registerTool("verified_resolve", {
    title: "Quote live verified resolve — $0.02", description: "Use when choosing a capability where stale/dead/incompatible candidates would waste time. Resolves and live-checks top MCP candidates. Returns a prefilled $0.02 USDC/Base x402 action; never spends.",
    inputSchema: z.object({ goal: z.string().min(1), url: z.string().url().optional() }), annotations: { title: "Quote live verified resolve — $0.02", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async ({ goal, url }) => { logToolCall("verified_resolve", { goalHash: shortHash(goal), quotedPriceUsd: 0.02 }); const action = paid("verified-resolve", "/api/verified-resolve", 0.02, { goal, ...(url ? { url } : {}) }); return { content: [{ type: "text", text: JSON.stringify(action) }], structuredContent: action }; });

  server.registerTool("batch_verified_resolve", {
    title: "Quote batch verified resolve — $0.05", description: "Use when an agent has 2–4 missing capability decisions and wants one paid batch with live evidence. Returns a prefilled $0.05 USDC/Base x402 action; never spends.",
    inputSchema: z.object({ items: z.array(z.object({ goal: z.string().min(1), url: z.string().url().optional() })).min(2).max(4) }), annotations: { title: "Quote batch verified resolve — $0.05", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async ({ items }) => { logToolCall("batch_verified_resolve", { itemCount: items.length, quotedPriceUsd: 0.05 }); const action = paid("batch-verified-resolve", "/api/batch-verified-resolve", 0.05, { items }); return { content: [{ type: "text", text: JSON.stringify(action) }], structuredContent: action }; });

  return server;
});
export async function POST(req: Request) { await logMcpRequest(req); return handler.fetch(req); }
export async function GET(req: Request) { return handler.fetch(req); }
export async function DELETE(req: Request) { return handler.fetch(req); }
export async function HEAD() { return new Response(null, { status: 200, headers: { "cache-control": "public, max-age=60" } }); }
