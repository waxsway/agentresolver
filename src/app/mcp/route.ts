import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { resolveGoal } from "@/lib/resolver";
import { getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import { inspectHttpResource } from "@/lib/httpInspect";
import { selectOpenApiOperation } from "@/lib/openapiSelect";
import { verifiedResolve } from "@/lib/verifiedResolve";
import { evaluateToolContract } from "@/lib/toolContract";
import { probeMcpEndpoint } from "@/lib/mcpProbe";
import { auditAgentReadiness } from "@/lib/agentReadiness";
import { batchVerifiedResolve } from "@/lib/batchVerifiedResolve";
import { runHashEncode, type HashEncodeOperation } from "@/lib/hashEncode";
import { createLazyPaidMcpTool } from "@/lib/mcpPayments";
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

const hashEncodeProduct = getPaidCapability("hash-encode");
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
    instructions: "AgentResolver is a machine-first capability discovery and live-evidence service. Use `resolve` for free whenever an external capability is missing. priced AgentResolver tools are directly payable over x402 inside MCP: an x402-aware client can receive a local payment challenge, apply its own spending policy, and retry the same tools/call with payment. Unpaid tool calls never execute paid capability work. Never spend unless the calling host independently authorizes the displayed USDC/Base price."
  });

  server.registerTool("resolve", {
    title: "Resolve a missing capability", description: "Free default discovery. Find ranked tools, APIs, MCP servers and machine services, with a prefilled paid live-evidence action when useful.",
    inputSchema: z.object({ goal: z.string().min(1), url: z.string().url().optional(), limit: z.number().int().min(1).max(10).optional() }),
    annotations: { title: "Resolve a missing capability", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async ({ goal, url, limit }) => {
    const resolution = await resolveGoal(goal, url, limit || 3);
    const owned = resolution.owned.map((match) => ({ ...match, execute: match.status === "live" && match.endpoint ? `${CANONICAL}${match.endpoint}` : null, spendingAuthorizationRequired: match.priceUsd > 0 }));
    const candidateCount = resolution.mcp.length + resolution.marketplace.length;
    const singleMcp = resolution.mcp.length === 1 ? resolution.mcp[0] : null;
    const singleMcpEndpoint = singleMcp && typeof singleMcp.endpoint === "string" && /^https?:\/\//i.test(singleMcp.endpoint) ? singleMcp.endpoint : null;
    const topOwned = owned.find((match) => match.rank === 1 && match.status === "live" && match.priceUsd > 0);
    const directOwnedId = topOwned?.id && topOwned.id in {
      "http-inspect": true,
      "tool-contract": true,
      "mcp-probe": true,
      "agent-readiness": true,
      "openapi-select": true,
      "verified-resolve": true,
      "batch-verified-resolve": true
    } ? topOwned.id as PaidCapabilityId : null;

    const directInput = directOwnedId === "http-inspect" && url
      ? { url }
      : directOwnedId === "agent-readiness" && url
        ? { url }
        : directOwnedId === "openapi-select" && url
          ? { specUrl: url, goal }
          : directOwnedId === "mcp-probe" && singleMcpEndpoint
            ? { endpoint: singleMcpEndpoint }
            : directOwnedId === "verified-resolve"
              ? { goal, ...(url ? { url } : {}) }
              : null;

    const directMcpTool = directOwnedId === "http-inspect"
      ? "http_inspect"
      : directOwnedId === "mcp-probe"
        ? "mcp_preflight"
        : directOwnedId === "agent-readiness"
          ? "agent_readiness"
          : directOwnedId === "openapi-select"
            ? "openapi_select"
            : directOwnedId === "verified-resolve"
              ? "verified_resolve"
              : null;
    const directMcpProduct = directOwnedId === "http-inspect"
      ? httpInspectProduct
      : directOwnedId === "mcp-probe"
        ? mcpProbeProduct
        : directOwnedId === "agent-readiness"
          ? readinessProduct
          : directOwnedId === "openapi-select"
            ? openApiSelectProduct
            : directOwnedId === "verified-resolve"
              ? verifiedResolveProduct
              : null;
    const directMcpRec = directMcpTool && directMcpProduct && directInput
      ? {
          capabilityId: directOwnedId as "http-inspect" | "mcp-probe" | "agent-readiness" | "openapi-select" | "verified-resolve",
          surface: "mcp" as const,
          tool: directMcpTool,
          execute: `${CANONICAL}/mcp`,
          input: directInput,
          priceUsd: directMcpProduct.priceUsd,
          asset: "USDC" as const,
          network: "eip155:8453" as const,
          protocol: "x402" as const,
          spendingAuthorizationRequired: true as const,
          spendingAuthorized: false as const,
          reason: `The highest-ranked live AgentResolver capability directly matches this goal and is payable inside MCP. Call ${directMcpTool} with the prefilled input; execute only if the host independently authorizes the x402 price.`
        }
      : null;

    const directHttpRec = directOwnedId && directInput && !directMcpTool
      ? { ...paid(directOwnedId, directInput), surface: "http" as const, reason: "The highest-ranked live AgentResolver capability directly matches this goal. Use this owned product before broader verification." }
      : null;

    const verifiedResolveMcpRec = {
      capabilityId: "verified-resolve" as const,
      surface: "mcp" as const,
      tool: "verified_resolve" as const,
      execute: `${CANONICAL}/mcp`,
      input: { goal, ...(url ? { url } : {}) },
      priceUsd: verifiedResolveProduct.priceUsd,
      asset: "USDC" as const,
      network: "eip155:8453" as const,
      protocol: "x402" as const,
      spendingAuthorizationRequired: true as const,
      spendingAuthorized: false as const,
      reason: "Discovery returned multiple or uncertain external candidates. Verified Resolve is payable inside MCP and adds up to two unpaid live verification probes after settlement."
    };

    const rec = directMcpRec
      || directHttpRec
      || (singleMcpEndpoint ? {
        capabilityId: "mcp-probe" as const,
        surface: "mcp" as const,
        tool: "mcp_preflight" as const,
        execute: `${CANONICAL}/mcp`,
        input: { endpoint: singleMcpEndpoint },
        priceUsd: mcpProbeProduct.priceUsd,
        asset: "USDC" as const,
        network: "eip155:8453" as const,
        protocol: "x402" as const,
        spendingAuthorizationRequired: true as const,
        spendingAuthorized: false as const,
        reason: "One MCP candidate found; mcp_preflight can live-check it inside MCP after the caller authorizes payment."
      }
      : resolution.mcp.length > 0 || candidateCount > 1 ? verifiedResolveMcpRec : null);

    logToolCall("resolve", { goalHash: shortHash(goal), goalLength: goal.length, intentTags: classifyIntent(goal), mcpMatches: resolution.mcp.length, marketplaceMatches: resolution.marketplace.length, paidRecommendationShown: Boolean(rec), paidRecommendationCapability: rec?.capabilityId || null, paidRecommendationSurface: rec?.surface || null });
    if (rec) console.log(JSON.stringify({ event: "paid_recommendation_shown", surface: "mcp", executionSurface: rec.surface, at: new Date().toISOString(), capabilityId: rec.capabilityId, priceUsd: rec.priceUsd, goalHash: shortHash(goal) }));
    const output = { goal, url: url || null, free: true, readOnly: true, spendingAuthorized: false, owned, mcp: resolution.mcp, marketplace: resolution.marketplace, recommendedPaidAction: rec,
      nextAction: rec ? (rec.surface === "mcp" ? `Optional direct MCP execution costs ${formatUsd(rec.priceUsd)} USDC on Base. Call ${rec.tool} with the prefilled input only if your existing spending policy independently authorizes it.` : `Optional live evidence costs ${formatUsd(rec.priceUsd)} USDC on Base. The executable request is prefilled. Execute only if your existing spending policy independently authorizes it.`) : "Choose the best relevant result; refine the goal and resolve again if needed.",
      rediscovery: { mcp: `${CANONICAL}/mcp`, resolver: `${CANONICAL}/api/resolve`, paidManifest: `${CANONICAL}/.well-known/x402` } };
    return { content: [{ type: "text", text: JSON.stringify(output) }], structuredContent: output };
  });

  server.registerTool("hash_encode", {
    title: hashEncodeProduct.quoteTool.title,
    description: hashEncodeProduct.quoteTool.description,
    inputSchema: z.object({
      operation: z.enum(["sha256", "sha512", "hmac-sha256", "base64-encode", "base64-decode", "jwt-decode"]),
      input: z.string().max(131072),
      secret: z.string().max(4096).optional()
    }),
    annotations: { title: hashEncodeProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ operation: HashEncodeOperation; input: string; secret?: string }>("hash-encode", async ({ operation, input, secret }) => {
    logToolCall("hash_encode", { priceUsd: hashEncodeProduct.priceUsd, mode: "direct_paid_mcp", operation });
    const report = runHashEncode({ operation, input, ...(secret !== undefined ? { secret } : {}) });
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "hash-encode",
      surface: "mcp",
      at: new Date().toISOString(),
      operation,
      inputBytes: report.inputBytes
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(report) }],
      structuredContent: report as unknown as Record<string, unknown>
    };
  }));

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
  }, createLazyPaidMcpTool<{ producerOutputSchema: Record<string, unknown>; consumerInputSchema: Record<string, unknown> }>("tool-contract", async ({ producerOutputSchema, consumerInputSchema }) => {
    logToolCall("tool_contract", { priceUsd: toolContractProduct.priceUsd, mode: "direct_paid_mcp" });
    const report = evaluateToolContract(producerOutputSchema, consumerInputSchema);
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "tool-contract",
      surface: "mcp",
      at: new Date().toISOString(),
      verdict: report.verdict
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(report) }],
      structuredContent: report as unknown as Record<string, unknown>
    };
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
      confidence: report.confidence,
      operationCount: report.api.operationCount,
      selectedOperationId: report.selected?.operationId || null
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(report) }],
      structuredContent: report as unknown as Record<string, unknown>
    };
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
      mcpCompatible: report.mcpCompatible
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(report) }],
      structuredContent: report as unknown as Record<string, unknown>
    };
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
      grade: report.grade
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(report) }],
      structuredContent: report as unknown as Record<string, unknown>
    };
  }));

  server.registerTool("verified_resolve", {
    title: verifiedResolveProduct.quoteTool.title, description: verifiedResolveProduct.quoteTool.description,
    inputSchema: z.object({ goal: z.string().min(1).max(1000), url: z.string().url().optional() }), annotations: { title: verifiedResolveProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, createLazyPaidMcpTool<{ goal: string; url?: string }>("verified-resolve", async ({ goal, url }) => {
    logToolCall("verified_resolve", { goalHash: shortHash(goal), priceUsd: verifiedResolveProduct.priceUsd, mode: "direct_paid_mcp" });
    const report = await verifiedResolve(goal, url);
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "verified-resolve",
      surface: "mcp",
      at: new Date().toISOString(),
      mcpProbeCount: report.liveVerification.length,
      marketplaceProbeCount: report.liveMarketplaceVerification.length,
      recommendationType: report.recommendation.type
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(report) }],
      structuredContent: report as unknown as Record<string, unknown>
    };
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
      itemCount: report.count,
      durationMs: report.durationMs
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(report) }],
      structuredContent: report as unknown as Record<string, unknown>
    };
  }));

  return server;
});
export async function POST(req: Request) { await logMcpRequest(req); return handler.fetch(req); }
export async function GET(req: Request) { return handler.fetch(req); }
export async function DELETE(req: Request) { return handler.fetch(req); }
export async function HEAD() { return new Response(null, { status: 200, headers: { "cache-control": "public, max-age=60" } }); }
