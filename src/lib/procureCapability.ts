import { resolveGoal } from "@/lib/resolver";
import { resolveProviderRoutes } from "@/lib/providerNetwork";
import { discoverPayAiResources, type PayAiMatch } from "@/lib/payaiDiscovery";
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

const BASE = "eip155:8453";
const SOLANA = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

function paidCapabilityId(value: string): PaidCapabilityId | null {
  return value in PAID_CAPABILITIES ? (value as PaidCapabilityId) : null;
}

function methodForOwned(id: string): "GET" | "POST" | null {
  if (
    id === "x402-ping" ||
    id === "x402-payment-preflight" ||
    id === "x402-settlement-verify"
  ) {
    return "GET";
  }
  return id in PAID_CAPABILITIES ? "POST" : null;
}

function asSchema(value: unknown): JsonSchema | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonSchema)
    : null;
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
    inputSchema: product ? asSchema(product.inputSchema) : null,
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
    inputSchema: asSchema(match.input),
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

function normalizePayAi(
  match: PayAiMatch,
  index: number
): ProcurementCandidate {
  const networks = [
    ...new Set(
      match.accepts
        .map((accept) => accept.network)
        .filter((value): value is string => Boolean(value))
    )
  ];

  return {
    id: `payai:${match.resource}`,
    source: match.source,
    sourceRank: index + 1,
    name: match.provider || match.resource,
    description: match.description,
    endpoint: match.resource,
    protocol: "x402",
    priceUsd: match.estimatedUsdPrice,
    networks,
    inputSchema: null,
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
      catalog: "payai",
      lastUpdated: match.lastUpdated
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

export type ProcurementResult = {
  selected: ReturnType<typeof rankProcurementCandidates>[number] | null;
  candidates: ReturnType<typeof rankProcurementCandidates>;
  candidateCount: number;
  verification: {
    recommended: boolean;
    reason: string;
    paidAction?: {
      method: "POST";
      url: string;
      priceUsd: 0.02;
      asset: "USDC";
      networks: [typeof BASE, typeof SOLANA];
      protocol: "x402";
      spendingAuthorizationRequired: true;
      input: { goal: string };
    };
  };
};

export async function procureCapability(
  goal: string,
  constraints: ProcurementConstraints,
  limit: number,
  baseUrl: string
): Promise<ProcurementResult> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 20));
  const candidateLimit = Math.min(safeLimit * 2, 10);

  const [resolution, partnerRoutes, payai] = await Promise.all([
    resolveGoal(goal, undefined, candidateLimit),
    Promise.resolve(
      resolveProviderRoutes(goal, candidateLimit).filter(
        (route) => route.disclosure === "provider-partner"
      )
    ),
    discoverPayAiResources(goal, candidateLimit)
  ]);

  const candidates: ProcurementCandidate[] = [
    ...resolution.owned.map((match) => normalizeOwned(match, baseUrl)),
    ...partnerRoutes.map(normalizePartner),
    ...payai.map(normalizePayAi),
    ...resolution.marketplace.map(normalizeMarketplace),
    ...resolution.mcp.map(normalizeMcp)
  ];

  const evaluated = rankProcurementCandidates(
    candidates,
    constraints,
    safeLimit
  );
  const selected =
    evaluated.find((candidate) => candidate.status !== "rejected") || null;

  return {
    selected,
    candidates: evaluated,
    candidateCount: candidates.length,
    verification:
      selected?.status === "eligible_with_unknowns"
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
          }
  };
}
