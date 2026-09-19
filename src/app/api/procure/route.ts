import { NextResponse } from "next/server";
import { resolveGoal } from "@/lib/resolver";
import { resolveProviderRoutes } from "@/lib/providerNetwork";
import {
  PAID_CAPABILITIES,
  getPaidCapability,
  type PaidCapabilityId
} from "@/lib/paidCapabilities";
import {
  rankProcurementCandidates,
  type JsonSchema,
  type ProcurementCandidate,
  type ProcurementConstraints
} from "@/lib/procurement";
import { callerHash, classifyIntent, safeUserAgent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

const MAX_GOAL_LENGTH = 1000;
const MAX_SCHEMA_BYTES = 50_000;
const BASE = "eip155:8453";
const SOLANA = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

function schemaOrNull(value: unknown): JsonSchema | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (JSON.stringify(value).length > MAX_SCHEMA_BYTES) return null;
  } catch {
    return null;
  }
  return value as JsonSchema;
}

function paidCapabilityId(value: string): PaidCapabilityId | null {
  return value in PAID_CAPABILITIES ? (value as PaidCapabilityId) : null;
}

function methodForOwned(id: string): "GET" | "POST" | null {
  if (id === "x402-ping" || id === "x402-payment-preflight" || id === "x402-settlement-verify") {
    return "GET";
  }
  return id in PAID_CAPABILITIES ? "POST" : null;
}

function normalizeOwned(
  match: Awaited<ReturnType<typeof resolveGoal>>["owned"][number],
  baseUrl: string
): ProcurementCandidate {
  const paidId = paidCapabilityId(match.id);
  const product = paidId ? getPaidCapability(paidId) : null;
  const endpoint = match.endpoint ? `${baseUrl}${match.endpoint}` : null;
  return {
    id: `owned:${match.id}`,
    source: "agentresolver-owned",
    sourceRank: match.rank,
    name: match.name,
    description: match.description,
    endpoint,
    protocol: match.priceUsd > 0 ? "x402" : "http",
    priceUsd: match.priceUsd,
    networks: match.priceUsd > 0 ? [BASE, SOLANA] : [],
    inputSchema: product?.inputSchema ?? null,
    outputSchema: null,
    sideEffect: "unknown",
    auth: match.priceUsd > 0 ? "wallet" : "none",
    execute: endpoint
      ? {
          url: endpoint,
          method: methodForOwned(match.id),
          protocol: match.priceUsd > 0 ? "x402" : "http",
          priceUsd: match.priceUsd,
          spendingAuthorizationRequired: match.priceUsd > 0
        }
      : null,
    evidence: {
      ownership: "first-party",
      live: match.status === "live"
    }
  };
}

function normalizeMarketplace(
  match: Awaited<ReturnType<typeof resolveGoal>>["marketplace"][number],
  index: number
): ProcurementCandidate {
  const networks = [
    ...new Set(
      match.accepts
        .map((accept) => accept.network)
        .filter((value): value is string => Boolean(value))
    )
  ];
  const inputSchema = schemaOrNull(match.input);
  return {
    id: `circle:${match.resource}`,
    source: match.source,
    sourceRank: index + 1,
    name: match.provider || match.resource,
    description: match.description,
    endpoint: match.resource,
    protocol: "x402",
    priceUsd: match.estimatedUsdPrice,
    networks,
    inputSchema,
    outputSchema: null,
    sideEffect: "unknown",
    auth: "wallet",
    execute: {
      url: match.resource,
      protocol: "x402",
      priceUsd: match.estimatedUsdPrice,
      accepts: match.accepts,
      spendingAuthorizationRequired: true
    },
    evidence: {
      supportsVanillax402: match.supportsVanillax402,
      supportsCircleGateway: match.supportsCircleGateway
    }
  };
}

function normalizeMcp(
  match: Awaited<ReturnType<typeof resolveGoal>>["mcp"][number],
  index: number
): ProcurementCandidate {
  return {
    id: `mcp:${match.endpoint || match.name || index}`,
    source: match.source,
    sourceRank: index + 1,
    name: match.title || match.name || match.endpoint || "MCP service",
    description: match.description,
    endpoint: match.endpoint,
    protocol: "mcp",
    priceUsd: null,
    networks: [],
    inputSchema: null,
    outputSchema: null,
    sideEffect: "unknown",
    auth: "unknown",
    execute: match.endpoint
      ? {
          url: match.endpoint,
          protocol: "mcp",
          transport: match.transport
        }
      : null,
    evidence: {
      transport: match.transport,
      verifiedLive: match.verifiedLive,
      repository: match.repository,
      website: match.website
    }
  };
}

function normalizePartner(
  route: ReturnType<typeof resolveProviderRoutes>[number]
): ProcurementCandidate {
  return {
    id: `provider:${route.routeId}`,
    source: "agentresolver-provider-network",
    sourceRank: route.rank,
    name: route.name,
    description: route.description,
    endpoint: route.execute.url,
    protocol: "x402",
    priceUsd: route.execute.priceUsd,
    networks: [...route.execute.networks],
    inputSchema: null,
    outputSchema: null,
    sideEffect: "unknown",
    auth: "wallet",
    execute: {
      method: route.execute.method,
      url: route.execute.url,
      protocol: "x402",
      priceUsd: route.execute.priceUsd,
      asset: route.execute.asset,
      networks: route.execute.networks,
      spendingAuthorizationRequired: true,
      attributionFunding: route.funding
    },
    evidence: {
      disclosure: route.disclosure,
      sponsored: route.sponsored
    }
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        goal?: unknown;
        limit?: unknown;
        constraints?: {
          maxPriceUsd?: unknown;
          preferredNetworks?: unknown;
          protocol?: unknown;
          requireHttps?: unknown;
          availableInputSchema?: unknown;
          requiredOutputSchema?: unknown;
          sideEffect?: unknown;
          auth?: unknown;
        };
      }
    | null;

  const goal = String(body?.goal || "").trim();
  if (!goal) {
    return NextResponse.json(
      { error: "MISSING_GOAL", message: "Provide the capability the agent needs." },
      { status: 400 }
    );
  }
  if (goal.length > MAX_GOAL_LENGTH) {
    return NextResponse.json(
      { error: "GOAL_TOO_LONG", message: `Goal must be ${MAX_GOAL_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }

  const parsedLimit = Number(body?.limit ?? 5);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(Math.floor(parsedLimit), 20))
    : 5;

  const raw = body?.constraints || {};
  const maxPriceUsd =
    raw.maxPriceUsd === undefined ? undefined : Number(raw.maxPriceUsd);
  if (
    maxPriceUsd !== undefined &&
    (!Number.isFinite(maxPriceUsd) || maxPriceUsd < 0 || maxPriceUsd > 1000)
  ) {
    return NextResponse.json(
      { error: "INVALID_MAX_PRICE", message: "maxPriceUsd must be between 0 and 1000." },
      { status: 400 }
    );
  }

  const preferredNetworks = Array.isArray(raw.preferredNetworks)
    ? raw.preferredNetworks
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 8)
    : undefined;

  const protocol =
    raw.protocol === "x402" || raw.protocol === "mcp" || raw.protocol === "any"
      ? raw.protocol
      : undefined;
  const sideEffect =
    raw.sideEffect === "read-only" ||
    raw.sideEffect === "state-changing" ||
    raw.sideEffect === "any"
      ? raw.sideEffect
      : undefined;
  const auth =
    raw.auth === "none" ||
    raw.auth === "wallet" ||
    raw.auth === "api-key" ||
    raw.auth === "any"
      ? raw.auth
      : undefined;

  const availableInputSchema =
    raw.availableInputSchema === undefined
      ? undefined
      : schemaOrNull(raw.availableInputSchema);
  const requiredOutputSchema =
    raw.requiredOutputSchema === undefined
      ? undefined
      : schemaOrNull(raw.requiredOutputSchema);

  if (raw.availableInputSchema !== undefined && !availableInputSchema) {
    return NextResponse.json(
      { error: "INVALID_INPUT_SCHEMA", message: "availableInputSchema must be a bounded JSON Schema object." },
      { status: 400 }
    );
  }
  if (raw.requiredOutputSchema !== undefined && !requiredOutputSchema) {
    return NextResponse.json(
      { error: "INVALID_OUTPUT_SCHEMA", message: "requiredOutputSchema must be a bounded JSON Schema object." },
      { status: 400 }
    );
  }

  const constraints: ProcurementConstraints = {
    ...(maxPriceUsd !== undefined ? { maxPriceUsd } : {}),
    ...(preferredNetworks ? { preferredNetworks } : {}),
    ...(protocol ? { protocol } : {}),
    requireHttps: raw.requireHttps !== false,
    ...(availableInputSchema ? { availableInputSchema } : {}),
    ...(requiredOutputSchema ? { requiredOutputSchema } : {}),
    ...(sideEffect ? { sideEffect } : {}),
    ...(auth ? { auth } : {})
  };

  const [resolution, partnerRoutes] = await Promise.all([
    resolveGoal(goal, undefined, Math.min(limit * 2, 10)),
    Promise.resolve(
      resolveProviderRoutes(goal, Math.min(limit * 2, 10)).filter(
        (route) => route.disclosure === "provider-partner"
      )
    )
  ]);

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin).replace(/\/$/, "");
  const candidates: ProcurementCandidate[] = [
    ...resolution.owned.map((match) => normalizeOwned(match, baseUrl)),
    ...partnerRoutes.map(normalizePartner),
    ...resolution.marketplace.map(normalizeMarketplace),
    ...resolution.mcp.map(normalizeMcp)
  ];

  const evaluated = rankProcurementCandidates(candidates, constraints, limit);
  const selected = evaluated.find((candidate) => candidate.status !== "rejected") || null;
  const verificationNeeded =
    Boolean(selected) && selected?.status === "eligible_with_unknowns";

  console.log(
    JSON.stringify({
      event: "procurement_call",
      at: new Date().toISOString(),
      callerHash: callerHash(req),
      userAgent: safeUserAgent(req),
      intentTags: classifyIntent(goal),
      goalLength: goal.length,
      candidateCount: candidates.length,
      returnedCount: evaluated.length,
      selectedSource: selected?.source || null,
      selectedProtocol: selected?.protocol || null,
      selectedPriceUsd: selected?.priceUsd ?? null,
      selectedStatus: selected?.status || null,
      unknownConstraintCount: selected?.unknownConstraints.length || 0,
      rejectedCount: evaluated.filter((candidate) => candidate.status === "rejected").length
    })
  );

  return NextResponse.json(
    {
      schemaVersion: 1,
      resolver: "AgentResolver",
      mode: "open_world_non_custodial_procurement",
      goal,
      constraints,
      selected,
      candidates: evaluated,
      verification: verificationNeeded
        ? {
            recommended: true,
            reason:
              "The best candidate satisfies known hard constraints but one or more requested contract properties are not proven by catalog metadata.",
            paidAction: {
              method: "POST",
              url: `${baseUrl}/api/verified-resolve`,
              priceUsd: 0.02,
              asset: "USDC",
              networks: [BASE, SOLANA],
              protocol: "x402",
              spendingAuthorizationRequired: true,
              input: { goal }
            }
          }
        : {
            recommended: false,
            reason: selected
              ? "The selected candidate satisfies every constraint AgentResolver can currently prove from available metadata."
              : "No candidate survived the requested hard constraints."
          },
      boundaries: {
        accountRequired: false,
        apiKeyRequired: false,
        callerWalletControlledByAgentResolver: false,
        callerSpendAuthorizedByAgentResolver: false,
        arbitraryProxying: false,
        unknownMetadataIsNotTreatedAsVerified: true
      }
    },
    {
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}
