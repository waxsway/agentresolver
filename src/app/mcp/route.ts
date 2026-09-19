import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { resolveGoal } from "@/lib/resolver";
import { getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import { inspectHttpResource } from "@/lib/httpInspect";
import { buildX402PaymentGuardResult } from "@/lib/x402PaymentGuard";
import { selectOpenApiOperation } from "@/lib/openapiSelect";
import { verifiedResolve } from "@/lib/verifiedResolve";
import { evaluateToolContract } from "@/lib/toolContract";
import { probeMcpEndpoint } from "@/lib/mcpProbe";
import { auditAgentReadiness } from "@/lib/agentReadiness";
import { batchVerifiedResolve } from "@/lib/batchVerifiedResolve";
import { runHashEncode, type HashEncodeOperation } from "@/lib/hashEncode";
import { normalizeJson, validateJsonSchema, parseUrl, generateUuidV4, slugify } from "@/lib/deterministicUtilities";
import { convertEvmUnits, ethereumKeccak256, evmAddressChecksum, soliditySelector } from "@/lib/evmPrecision";
import { eip712TypedDataHash, ensNamehash, ethereumAbiDecode, ethereumAbiEncode } from "@/lib/evmAdvanced";
import { createLazyPaidMcpTool } from "@/lib/mcpPayments";
import { X402_PING_NEXT_ACTIONS } from "@/lib/x402PingDiscovery";
import { callerHash, classifyIntent, safeUserAgent, shortHash } from "@/lib/telemetry";
import { classifyTraffic } from "@/lib/trafficClassification";
import { resolveProviderRoutes } from "@/lib/providerNetwork";
import { parseProviderLaunchCheckInput, runProviderLaunchCheck } from "@/lib/providerLaunchCheck";
import { procureCapability } from "@/lib/procureCapability";
import type { ProcurementConstraints } from "@/lib/procurement";
import {
  getActiveSponsor,
  logSponsorImpression,
  sponsorPublicPayload,
  sponsorshipInventory
} from "@/lib/sponsorship";

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

const abiEncodeProduct = getPaidCapability("abi-encode");
const abiDecodeProduct = getPaidCapability("abi-decode");
const eip712HashProduct = getPaidCapability("eip712-hash");
const ensNamehashProduct = getPaidCapability("ens-namehash");
const evmAddressChecksumProduct = getPaidCapability("evm-address-checksum");
const keccak256Product = getPaidCapability("keccak256");
const soliditySelectorProduct = getPaidCapability("solidity-selector");
const evmUnitsProduct = getPaidCapability("evm-units");
const x402PingProduct = getPaidCapability("x402-ping");
const sha256Product = getPaidCapability("sha256");
const sha512Product = getPaidCapability("sha512");
const hmacSha256Product = getPaidCapability("hmac-sha256");
const base64EncodeProduct = getPaidCapability("base64-encode");
const base64DecodeProduct = getPaidCapability("base64-decode");
const jwtDecodeProduct = getPaidCapability("jwt-decode");
const jsonNormalizeProduct = getPaidCapability("json-normalize");
const jsonSchemaValidateProduct = getPaidCapability("json-schema-validate");
const urlParseProduct = getPaidCapability("url-parse");
const uuidV4Product = getPaidCapability("uuid-v4");
const slugifyProduct = getPaidCapability("slugify");
const hashEncodeProduct = getPaidCapability("hash-encode");
const httpInspectProduct = getPaidCapability("http-inspect");
const x402PaymentPreflightProduct = getPaidCapability("x402-payment-preflight");
const toolContractProduct = getPaidCapability("tool-contract");
const mcpProbeProduct = getPaidCapability("mcp-probe");
const readinessProduct = getPaidCapability("agent-readiness");
const openApiSelectProduct = getPaidCapability("openapi-select");
const verifiedResolveProduct = getPaidCapability("verified-resolve");
const batchVerifiedResolveProduct = getPaidCapability("batch-verified-resolve");
const providerLaunchCheckProduct = getPaidCapability("provider-launch-check");

const x402PingNextActionSchema = z.looseObject({
  capabilityId: z.string(),
  endpoint: z.string().url(),
  method: z.enum(["GET", "POST"]),
  priceUsd: z.number().nonnegative(),
  useWhen: z.string(),
  inputExample: z.record(z.string(), z.unknown())
});

const x402PingMcpOutputSchema = z.object({
  pong: z.literal(true),
  settledDelivery: z.literal(true),
  at: z.string(),
  unixMs: z.number().int().nonnegative(),
  requestId: z.string(),
  echo: z.string().nullable(),
  next: z.object({
    catalogUrl: z.string().url(),
    recommended: x402PingNextActionSchema.extend({
      method: z.literal("GET"),
      reason: z.string(),
      repeatUse: z.string(),
      paymentAuthorization: z.literal("separate_caller_authorization_required")
    }),
    preflight: x402PingNextActionSchema.extend({ method: z.literal("GET") }),
    settlementVerify: x402PingNextActionSchema.extend({
      method: z.literal("GET"),
      transactionHashSource: z.string(),
      paymentAuthorization: z.literal("separate_caller_authorization_required")
    }),
    single: x402PingNextActionSchema.extend({ method: z.literal("POST") }),
    batch: x402PingNextActionSchema.extend({ method: z.literal("POST") })
  })
});

const hashEncodeMcpOutputSchema = z.union([
  z.object({
    operation: z.enum(["sha256", "sha512", "hmac-sha256", "base64-encode", "base64-decode"]),
    inputBytes: z.number().int().nonnegative(),
    encoding: z.enum(["hex", "base64", "utf8"]),
    result: z.string()
  }),
  z.object({
    operation: z.literal("jwt-decode"),
    inputBytes: z.number().int().nonnegative(),
    verified: z.literal(false),
    note: z.string(),
    header: z.unknown(),
    payload: z.unknown(),
    signature: z.string()
  })
]);

const paymentGuardMcpOutputSchema = z.looseObject({
  url: z.string(),
  status: z.number().int(),
  ok: z.boolean(),
  latencyMs: z.number().nonnegative(),
  guard: z.looseObject({
    product: z.literal("AgentResolver Guard"),
    decision: z.enum(["eligible", "blocked"]),
    eligibleForCallerAuthorization: z.boolean(),
    reasonCodes: z.array(z.string()),
    evidenceDigestSha256: z.string(),
    paymentIdentityFingerprint: z.string().nullable(),
    paymentTermsFingerprint: z.string().nullable()
  }),
  prepaymentDecision: z.looseObject({
    decision: z.enum(["eligible", "blocked"]),
    eligibleForCallerAuthorization: z.boolean(),
    reasons: z.array(z.string())
  }),
  evidenceReceipt: z.looseObject({})
});
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
    const goal = method === "tools/call" && (tool === "resolve" || tool === "procure") && typeof body?.params?.arguments?.goal === "string"
      ? body.params.arguments.goal.trim()
      : "";
    const hasMcpPayment = Boolean(body?.params?._meta?.["x402/payment"]);
    const traffic = classifyTraffic(req, {
      path: "/mcp",
      mcpMethod: method,
      tool,
      hasUserIntent: Boolean(goal) || (method === "tools/call" && Boolean(tool)),
      hasPayment: hasMcpPayment
    });
    console.log(JSON.stringify({
      ...base,
      method,
      tool,
      hasMcpPayment,
      phase: tool ? (hasMcpPayment ? "paid_retry" : "tool_call") : null,
      trafficClass: traffic.trafficClass,
      external: traffic.external,
      sponsorEligible: traffic.sponsorEligible,
      trafficClassReason: traffic.reason,
      ...(goal ? { goalHash: shortHash(goal), goalLength: goal.length, intentTags: classifyIntent(goal) } : {})
    }));
  } catch {
    console.log(JSON.stringify({ ...base, method: "unparsed", tool: null, hasMcpPayment: false }));
  }
}

const handler = createMcpHandler(() => {
  const server = new McpServer({ name: "agentresolver", version: "0.1.3" }, {
    instructions: "AgentResolver is a machine-first capability discovery and live-evidence service. Use `procure` when an external capability must satisfy concrete budget/network/protocol/schema constraints; use `resolve` for broad free discovery. Providers can call `sponsorship_info` to inspect the labeled sponsorship pilot; sponsorship never changes organic ranking. Priced AgentResolver tools are directly payable over x402 inside MCP: an x402-aware client can receive a local payment challenge, apply its own spending policy, and retry the same tools/call with payment. Unpaid tool calls never execute paid capability work. Never spend unless the calling host independently authorizes the displayed USDC/Base price."
  });

  server.registerTool("sponsorship_info", {
    title: "Provider sponsorship information",
    description: "Free read-only information for tool/API/MCP providers about AgentResolver's explicitly labeled sponsorship pilot. Organic ranking remains independent; applying creates no purchase or financial commitment.",
    inputSchema: z.object({}),
    annotations: { title: "Provider sponsorship information", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async () => {
    const output = {
      free: true,
      readOnly: true,
      sponsoredPlacementsLabeled: true,
      organicRankingIndependent: true,
      applicationCreatesCommitment: false,
      inventory: sponsorshipInventory(CANONICAL),
      providerPage: `${CANONICAL}/providers`,
      manifest: `${CANONICAL}/.well-known/sponsorship.json`,
      apply: "https://github.com/waxsway/agentresolver/issues/new?template=sponsorship.yml"
    };
    logToolCall("sponsorship_info", { mode: "provider_discovery", financialCommitment: false });
    return { content: [{ type: "text", text: JSON.stringify(output) }], structuredContent: output };
  });

  server.registerTool("resolve", {
    title: "Resolve a missing capability", description: "Free default discovery. Find ranked tools, APIs, MCP servers and machine services, with a prefilled paid live-evidence action when useful.",
    inputSchema: z.object({ goal: z.string().min(1), url: z.string().url().optional(), limit: z.number().int().min(1).max(10).optional() }),
    annotations: { title: "Resolve a missing capability", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async ({ goal, url, limit }) => {
    const resolution = await resolveGoal(goal, url, limit || 3);
    const providerRoutes = resolveProviderRoutes(goal, Math.min(limit || 3, 5));
    const intentTags = classifyIntent(goal);
    const sponsor = getActiveSponsor(intentTags);
    const owned = resolution.owned.map((match) => ({ ...match, execute: match.status === "live" && match.endpoint ? `${CANONICAL}${match.endpoint}` : null, spendingAuthorizationRequired: match.priceUsd > 0 }));
    const candidateCount = resolution.mcp.length + resolution.marketplace.length;
    const singleMcp = resolution.mcp.length === 1 ? resolution.mcp[0] : null;
    const singleMcpEndpoint = singleMcp && typeof singleMcp.endpoint === "string" && /^https?:\/\//i.test(singleMcp.endpoint) ? singleMcp.endpoint : null;
    const topOwned = owned.find((match) => match.rank === 1 && match.status === "live" && match.priceUsd > 0);
    const directOwnedId = topOwned?.id && topOwned.id in {
      "x402-payment-preflight": true,
      "http-inspect": true,
      "tool-contract": true,
      "mcp-probe": true,
      "agent-readiness": true,
      "openapi-select": true,
      "verified-resolve": true,
      "batch-verified-resolve": true
    } ? topOwned.id as PaidCapabilityId : null;

    const directInput = directOwnedId === "x402-payment-preflight" && url
      ? { url }
      : directOwnedId === "http-inspect" && url
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

    const directMcpTool = directOwnedId === "x402-payment-preflight"
      ? "x402_payment_preflight"
      : directOwnedId === "http-inspect"
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
    const directMcpProduct = directOwnedId === "x402-payment-preflight"
      ? x402PaymentPreflightProduct
      : directOwnedId === "http-inspect"
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
          capabilityId: directOwnedId as "x402-payment-preflight" | "http-inspect" | "mcp-probe" | "agent-readiness" | "openapi-select" | "verified-resolve",
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

    logToolCall("resolve", { goalHash: shortHash(goal), goalLength: goal.length, intentTags, mcpMatches: resolution.mcp.length, marketplaceMatches: resolution.marketplace.length, providerRouteCount: providerRoutes.length, paidRecommendationShown: Boolean(rec), paidRecommendationCapability: rec?.capabilityId || null, paidRecommendationSurface: rec?.surface || null });
    if (sponsor) logSponsorImpression({ sponsor, placement: "mcp-resolve", intentTags, goal });
    if (rec) console.log(JSON.stringify({ event: "paid_recommendation_shown", surface: "mcp", executionSurface: rec.surface, at: new Date().toISOString(), capabilityId: rec.capabilityId, priceUsd: rec.priceUsd, goalHash: shortHash(goal) }));
    const output = { goal, url: url || null, free: true, readOnly: true, spendingAuthorized: false, sponsored: sponsor ? sponsorPublicPayload(sponsor) : null, sponsorship: sponsorshipInventory(CANONICAL), owned, mcp: resolution.mcp, marketplace: resolution.marketplace, providerRoutes, transactionRouter: { execute: `${CANONICAL}/api/execute`, providers: `${CANONICAL}/api/providers`, arbitraryProxying: false, callerSpendingAuthorized: false }, recommendedPaidAction: rec,
      nextAction: rec ? (rec.surface === "mcp" ? `Optional direct MCP execution costs ${formatUsd(rec.priceUsd)} USDC on Base. Call ${rec.tool} with the prefilled input only if your existing spending policy independently authorizes it.` : `Optional live evidence costs ${formatUsd(rec.priceUsd)} USDC on Base. The executable request is prefilled. Execute only if your existing spending policy independently authorizes it.`) : "Choose the best relevant result; refine the goal and resolve again if needed.",
      rediscovery: { mcp: `${CANONICAL}/mcp`, resolver: `${CANONICAL}/api/resolve`, providerNetwork: `${CANONICAL}/api/providers`, execute: `${CANONICAL}/api/execute`, paidManifest: `${CANONICAL}/.well-known/x402` } };
    return { content: [{ type: "text", text: JSON.stringify(output) }], structuredContent: output };
  });

  server.registerTool("procure", {
    title: "Procure a compatible capability",
    description: "Free open-world multi-protocol procurement. Declare the capability needed plus hard budget, network, protocol, schema, side-effect and auth constraints across x402, L402, MPP and MCP. AgentResolver rejects incompatible candidates, surfaces unknown evidence explicitly, and returns a non-custodial execution/payment handoff without authorizing spend.",
    inputSchema: z.object({
      goal: z.string().min(1).max(1000),
      limit: z.number().int().min(1).max(20).optional(),
      providerOrigins: z
        .array(z.string().url())
        .max(2)
        .optional(),
      constraints: z.object({
        maxPriceUsd: z.number().min(0).max(1000).optional(),
        preferredNetworks: z.array(z.string().min(1).max(128)).max(8).optional(),
        protocol: z.enum(["x402", "l402", "mpp", "mcp", "any"]).optional(),
        requireHttps: z.boolean().optional(),
        availableInputSchema: z.record(z.string(), z.unknown()).optional(),
        requiredOutputSchema: z.record(z.string(), z.unknown()).optional(),
        sideEffect: z.enum(["read-only", "state-changing", "any"]).optional(),
        auth: z.enum(["none", "wallet", "api-key", "any"]).optional()
      }).optional()
    }),
    annotations: {
      title: "Procure a compatible capability",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  }, async ({ goal, limit, providerOrigins, constraints }) => {
    const result = await procureCapability(
      goal,
      (constraints || {}) as ProcurementConstraints,
      limit || 5,
      CANONICAL,
      { providerOrigins }
    );
    logToolCall("procure", {
      goalHash: shortHash(goal),
      goalLength: goal.length,
      intentTags: classifyIntent(goal),
      candidateCount: result.candidateCount,
      returnedCount: result.candidates.length,
      selectedSource: result.selected?.source || null,
      selectedStatus: result.selected?.status || null,
      selectedPriceUsd: result.selected?.priceUsd ?? null,
      providerSeedCount: providerOrigins?.length || 0
    });
    const output = {
      schemaVersion: 1,
      resolver: "AgentResolver",
      mode: "open_world_non_custodial_procurement",
      goal,
      constraints: constraints || {},
      providerOrigins: providerOrigins || [],
      selected: result.selected,
      candidates: result.candidates,
      verification: result.verification,
      boundaries: {
        accountRequired: false,
        apiKeyRequired: false,
        callerWalletControlledByAgentResolver: false,
        callerSpendAuthorizedByAgentResolver: false,
        arbitraryProxying: false,
        unknownMetadataIsNotTreatedAsVerified: true
      }
    };
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output
    };
  });

  const simplePaidResult = (capabilityId: PaidCapabilityId, tool: string, report: Record<string, unknown>) => {
    logToolCall(tool, { priceUsd: getPaidCapability(capabilityId).priceUsd, mode: "direct_paid_mcp" });
    console.log(JSON.stringify({ event: "paid_capability_completed", capabilityId, surface: "mcp", at: new Date().toISOString() }));
    return { content: [{ type: "text" as const, text: JSON.stringify(report) }], structuredContent: report };
  };

  server.registerTool("abi_encode", {
    title: abiEncodeProduct.quoteTool.title, description: abiEncodeProduct.quoteTool.description,
    inputSchema: z.object({ types: z.array(z.string().min(1).max(512)).min(1).max(32), values: z.array(z.unknown()).max(32) }),
    annotations: { title: abiEncodeProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ types: string[]; values: unknown[] }>("abi-encode", async ({ types, values }) =>
    simplePaidResult("abi-encode", "abi_encode", ethereumAbiEncode({ types, values }))
  ));

  server.registerTool("abi_decode", {
    title: abiDecodeProduct.quoteTool.title, description: abiDecodeProduct.quoteTool.description,
    inputSchema: z.object({ types: z.array(z.string().min(1).max(512)).min(1).max(32), data: z.string().max(262146) }),
    annotations: { title: abiDecodeProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ types: string[]; data: string }>("abi-decode", async ({ types, data }) =>
    simplePaidResult("abi-decode", "abi_decode", ethereumAbiDecode({ types, data }))
  ));

  server.registerTool("eip712_hash", {
    title: eip712HashProduct.quoteTool.title, description: eip712HashProduct.quoteTool.description,
    inputSchema: z.object({
      domain: z.record(z.string(), z.unknown()),
      types: z.record(z.string(), z.array(z.object({ name: z.string(), type: z.string() }))),
      primaryType: z.string().min(1).max(128),
      message: z.record(z.string(), z.unknown())
    }),
    annotations: { title: eip712HashProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ domain: Record<string, unknown>; types: Record<string, Array<{ name: string; type: string }>>; primaryType: string; message: Record<string, unknown> }>("eip712-hash", async ({ domain, types, primaryType, message }) =>
    simplePaidResult("eip712-hash", "eip712_hash", eip712TypedDataHash({ domain, types, primaryType, message }))
  ));

  server.registerTool("ens_namehash", {
    title: ensNamehashProduct.quoteTool.title, description: ensNamehashProduct.quoteTool.description,
    inputSchema: z.object({ name: z.string().min(1).max(255) }),
    annotations: { title: ensNamehashProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ name: string }>("ens-namehash", async ({ name }) =>
    simplePaidResult("ens-namehash", "ens_namehash", ensNamehash(name))
  ));

  server.registerTool("evm_address_checksum", {
    title: evmAddressChecksumProduct.quoteTool.title, description: evmAddressChecksumProduct.quoteTool.description,
    inputSchema: z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }),
    annotations: { title: evmAddressChecksumProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ address: string }>("evm-address-checksum", async ({ address }) =>
    simplePaidResult("evm-address-checksum", "evm_address_checksum", evmAddressChecksum(address))
  ));

  server.registerTool("keccak256", {
    title: keccak256Product.quoteTool.title, description: keccak256Product.quoteTool.description,
    inputSchema: z.object({ input: z.string().max(131072), encoding: z.enum(["utf8", "hex"]).optional() }),
    annotations: { title: keccak256Product.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ input: string; encoding?: "utf8" | "hex" }>("keccak256", async ({ input, encoding }) =>
    simplePaidResult("keccak256", "keccak256", ethereumKeccak256(input, encoding ?? "utf8"))
  ));

  server.registerTool("solidity_selector", {
    title: soliditySelectorProduct.quoteTool.title, description: soliditySelectorProduct.quoteTool.description,
    inputSchema: z.object({ signature: z.string().min(3).max(1024) }),
    annotations: { title: soliditySelectorProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ signature: string }>("solidity-selector", async ({ signature }) =>
    simplePaidResult("solidity-selector", "solidity_selector", soliditySelector(signature))
  ));

  server.registerTool("evm_units", {
    title: evmUnitsProduct.quoteTool.title, description: evmUnitsProduct.quoteTool.description,
    inputSchema: z.object({ mode: z.enum(["parse", "format"]), value: z.string().max(256), decimals: z.number().int().min(0).max(255) }),
    annotations: { title: evmUnitsProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ mode: "parse" | "format"; value: string; decimals: number }>("evm-units", async ({ mode, value, decimals }) =>
    simplePaidResult("evm-units", "evm_units", convertEvmUnits({ mode, value, decimals }))
  ));

  server.registerTool("x402_ping", {
    title: x402PingProduct.quoteTool.title, description: x402PingProduct.quoteTool.description,
    inputSchema: z.object({ echo: z.string().max(256).optional() }),
    outputSchema: x402PingMcpOutputSchema,
    annotations: { title: x402PingProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, createLazyPaidMcpTool<{ echo?: string }>("x402-ping", async ({ echo }) =>
    simplePaidResult("x402-ping", "x402_ping", {
      pong: true,
      settledDelivery: true,
      at: new Date().toISOString(),
      unixMs: Date.now(),
      requestId: generateUuidV4(1).values[0],
      echo: echo || null,
      next: X402_PING_NEXT_ACTIONS
    })
  ));

  server.registerTool("sha256", {
    title: sha256Product.quoteTool.title, description: sha256Product.quoteTool.description,
    inputSchema: z.object({ input: z.string().max(131072) }),
    annotations: { title: sha256Product.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ input: string }>("sha256", async ({ input }) =>
    simplePaidResult("sha256", "sha256", runHashEncode({ operation: "sha256", input }) as unknown as Record<string, unknown>)
  ));

  server.registerTool("sha512", {
    title: sha512Product.quoteTool.title, description: sha512Product.quoteTool.description,
    inputSchema: z.object({ input: z.string().max(131072) }),
    annotations: { title: sha512Product.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ input: string }>("sha512", async ({ input }) =>
    simplePaidResult("sha512", "sha512", runHashEncode({ operation: "sha512", input }) as unknown as Record<string, unknown>)
  ));

  server.registerTool("hmac_sha256", {
    title: hmacSha256Product.quoteTool.title, description: hmacSha256Product.quoteTool.description,
    inputSchema: z.object({ input: z.string().max(131072), secret: z.string().min(1).max(4096) }),
    annotations: { title: hmacSha256Product.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ input: string; secret: string }>("hmac-sha256", async ({ input, secret }) =>
    simplePaidResult("hmac-sha256", "hmac_sha256", runHashEncode({ operation: "hmac-sha256", input, secret }) as unknown as Record<string, unknown>)
  ));

  server.registerTool("base64_encode", {
    title: base64EncodeProduct.quoteTool.title, description: base64EncodeProduct.quoteTool.description,
    inputSchema: z.object({ input: z.string().max(131072) }),
    annotations: { title: base64EncodeProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ input: string }>("base64-encode", async ({ input }) =>
    simplePaidResult("base64-encode", "base64_encode", runHashEncode({ operation: "base64-encode", input }) as unknown as Record<string, unknown>)
  ));

  server.registerTool("base64_decode", {
    title: base64DecodeProduct.quoteTool.title, description: base64DecodeProduct.quoteTool.description,
    inputSchema: z.object({ input: z.string().max(131072) }),
    annotations: { title: base64DecodeProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ input: string }>("base64-decode", async ({ input }) =>
    simplePaidResult("base64-decode", "base64_decode", runHashEncode({ operation: "base64-decode", input }) as unknown as Record<string, unknown>)
  ));

  server.registerTool("jwt_decode", {
    title: jwtDecodeProduct.quoteTool.title, description: jwtDecodeProduct.quoteTool.description,
    inputSchema: z.object({ input: z.string().max(131072) }),
    annotations: { title: jwtDecodeProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ input: string }>("jwt-decode", async ({ input }) =>
    simplePaidResult("jwt-decode", "jwt_decode", runHashEncode({ operation: "jwt-decode", input }) as unknown as Record<string, unknown>)
  ));

  server.registerTool("json_normalize", {
    title: jsonNormalizeProduct.quoteTool.title, description: jsonNormalizeProduct.quoteTool.description,
    inputSchema: z.object({ value: z.unknown() }),
    annotations: { title: jsonNormalizeProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ value: unknown }>("json-normalize", async ({ value }) =>
    simplePaidResult("json-normalize", "json_normalize", normalizeJson(value))
  ));

  server.registerTool("json_schema_validate", {
    title: jsonSchemaValidateProduct.quoteTool.title, description: jsonSchemaValidateProduct.quoteTool.description,
    inputSchema: z.object({ data: z.unknown(), schema: z.record(z.string(), z.unknown()) }),
    annotations: { title: jsonSchemaValidateProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ data: unknown; schema: Record<string, unknown> }>("json-schema-validate", async ({ data, schema }) =>
    simplePaidResult("json-schema-validate", "json_schema_validate", validateJsonSchema(data, schema))
  ));

  server.registerTool("url_parse", {
    title: urlParseProduct.quoteTool.title, description: urlParseProduct.quoteTool.description,
    inputSchema: z.object({ url: z.string().max(4096) }),
    annotations: { title: urlParseProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ url: string }>("url-parse", async ({ url }) =>
    simplePaidResult("url-parse", "url_parse", parseUrl(url))
  ));

  server.registerTool("uuid_v4", {
    title: uuidV4Product.quoteTool.title, description: uuidV4Product.quoteTool.description,
    inputSchema: z.object({ count: z.number().int().min(1).max(20).optional() }),
    annotations: { title: uuidV4Product.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, createLazyPaidMcpTool<{ count?: number }>("uuid-v4", async ({ count }) =>
    simplePaidResult("uuid-v4", "uuid_v4", generateUuidV4(count || 1))
  ));

  server.registerTool("slugify", {
    title: slugifyProduct.quoteTool.title, description: slugifyProduct.quoteTool.description,
    inputSchema: z.object({ text: z.string().max(8192), separator: z.enum(["-", "_"]).optional() }),
    annotations: { title: slugifyProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, createLazyPaidMcpTool<{ text: string; separator?: "-" | "_" }>("slugify", async ({ text, separator }) =>
    simplePaidResult("slugify", "slugify", slugify(text, separator))
  ));

  server.registerTool("hash_encode", {
    title: hashEncodeProduct.quoteTool.title,
    description: hashEncodeProduct.quoteTool.description,
    inputSchema: z.object({
      operation: z.enum(["sha256", "sha512", "hmac-sha256", "base64-encode", "base64-decode", "jwt-decode"]),
      input: z.string().max(131072),
      secret: z.string().max(4096).optional()
    }),
    outputSchema: hashEncodeMcpOutputSchema,
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

  const paymentGuardInputSchema = z.object({
    url: z.string().url(),
    maxPriceUsd: z.number().min(0).max(1000).optional(),
    expectedPayTo: z.string().min(1).max(128).optional(),
    expectedNetwork: z.string().max(128).optional(),
    method: z.enum(["GET", "HEAD", "POST"]).optional(),
    body: z.unknown().optional(),
    allowUnpaidPostProbe: z.boolean().optional()
  });

  type PaymentGuardInput = {
    url: string;
    maxPriceUsd?: number;
    expectedPayTo?: string;
    expectedNetwork?: string;
    method?: "GET" | "HEAD" | "POST";
    body?: unknown;
    allowUnpaidPostProbe?: boolean;
  };

  const runPaymentGuard = (toolName: string) => createLazyPaidMcpTool<PaymentGuardInput>(
    "x402-payment-preflight",
    async ({ url, maxPriceUsd, expectedPayTo, expectedNetwork, method, body, allowUnpaidPostProbe }) => {
      logToolCall(toolName, {
        priceUsd: x402PaymentPreflightProduct.priceUsd,
        mode: "direct_paid_mcp",
        product: "AgentResolver Guard"
      });
      const constraints = { maxPriceUsd, expectedPayTo, expectedNetwork };
      const report = await inspectHttpResource(url, {
        ...constraints,
        method,
        body,
        allowUnpaidPostProbe
      });
      const result = buildX402PaymentGuardResult(report, constraints);
      console.log(JSON.stringify({
        event: "paid_capability_completed",
        capabilityId: "x402-payment-preflight",
        product: "AgentResolver Guard",
        surface: "mcp",
        tool: toolName,
        at: new Date().toISOString(),
        status: report.status,
        latencyMs: report.latencyMs,
        x402Detected: report.x402.detected,
        x402Verdict: report.x402.verdict,
        guardDecision: result.prepaymentDecision.decision,
        eligibleForCallerAuthorization: result.prepaymentDecision.eligibleForCallerAuthorization
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result
      };
    },
    {
      discoveryToolName: toolName,
      discoveryDescription: toolName === "payment_guard"
        ? "AgentResolver Guard: paid $0.001 fail-closed authorization preflight to run immediately before every autonomous x402 spend."
        : x402PaymentPreflightProduct.description,
      paymentToolName: toolName
    }
  );

  server.registerTool("payment_guard", {
    title: "AgentResolver Guard — verify before every x402 payment — $0.001",
    description: "Paid $0.001 USDC fail-closed payment authorization preflight. Use immediately before an autonomous agent signs a target x402 payment. Returns eligible/blocked, exact observed payment terms, reason codes, evidence receipt and stable fingerprints. The caller retains sole spending authority.",
    inputSchema: paymentGuardInputSchema,
    outputSchema: paymentGuardMcpOutputSchema,
    annotations: { title: "AgentResolver Guard — $0.001", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, runPaymentGuard("payment_guard"));

  server.registerTool("x402_payment_preflight", {
    title: x402PaymentPreflightProduct.quoteTool.title,
    description: x402PaymentPreflightProduct.quoteTool.description,
    inputSchema: paymentGuardInputSchema,
    outputSchema: paymentGuardMcpOutputSchema,
    annotations: { title: x402PaymentPreflightProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, runPaymentGuard("x402_payment_preflight"));

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

  server.registerTool("provider_launch_check", {
    title: providerLaunchCheckProduct.quoteTool.title,
    description: providerLaunchCheckProduct.quoteTool.description,
    inputSchema: z.object({
      providerId: z.string().min(1).max(80),
      providerName: z.string().min(1).max(120),
      capabilityId: z.string().min(1).max(120),
      name: z.string().min(1).max(160),
      description: z.string().min(1).max(500),
      origin: z.string().url(),
      endpoint: z.string().url(),
      method: z.enum(["GET", "POST"]).optional(),
      probeUrl: z.string().url().optional(),
      priceUsd: z.number().positive().max(1000),
      network: z.string().max(120).optional(),
      tags: z.array(z.string().max(80)).max(20).optional()
    }),
    annotations: {
      title: providerLaunchCheckProduct.quoteTool.title,
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  }, createLazyPaidMcpTool<Record<string, unknown>>("provider-launch-check", async (input) => {
    logToolCall("provider_launch_check", {
      priceUsd: providerLaunchCheckProduct.priceUsd,
      mode: "direct_paid_mcp"
    });
    const parsed = parseProviderLaunchCheckInput(input);
    const report = await runProviderLaunchCheck(parsed);
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "provider-launch-check",
      surface: "mcp",
      at: new Date().toISOString(),
      providerId: parsed.providerId,
      providerCapabilityId: parsed.capabilityId,
      eligibleForRegistryReview: report.eligibleForRegistryReview
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(report) }],
      structuredContent: report as unknown as Record<string, unknown>
    };
  }));

  server.registerTool("verified_resolve", {
    title: verifiedResolveProduct.quoteTool.title, description: verifiedResolveProduct.quoteTool.description,
    inputSchema: z.object({
      goal: z.string().min(1).max(1000),
      url: z.string().url().optional(),
      constraints: z.object({
        maxPriceUsd: z.number().min(0).max(1000).optional(),
        preferredNetworks: z.array(z.string().min(1).max(128)).max(8).optional(),
        protocol: z.enum(["x402", "l402", "mpp", "mcp", "any"]).optional(),
        requireHttps: z.boolean().optional(),
        availableInputSchema: z.record(z.string(), z.unknown()).optional(),
        requiredOutputSchema: z.record(z.string(), z.unknown()).optional(),
        sideEffect: z.enum(["read-only", "state-changing", "any"]).optional(),
        auth: z.enum(["none", "wallet", "api-key", "any"]).optional()
      }).optional()
    }), annotations: { title: verifiedResolveProduct.quoteTool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, createLazyPaidMcpTool<{ goal: string; url?: string; constraints?: ProcurementConstraints }>("verified-resolve", async ({ goal, url, constraints }) => {
    logToolCall("verified_resolve", { goalHash: shortHash(goal), priceUsd: verifiedResolveProduct.priceUsd, mode: "direct_paid_mcp" });
    const report = await verifiedResolve(goal, { url, constraints });
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "verified-resolve",
      surface: "mcp",
      at: new Date().toISOString(),
      liveProbeCount: report.liveVerification.length,
      verifiedMcpCount: report.liveMcpVerification.filter((item) => item.mcpCompatible).length,
      verifiedX402Count: report.liveMarketplaceVerification.filter((item) => item.x402Compatible && item.contractMatchesCatalog).length,
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