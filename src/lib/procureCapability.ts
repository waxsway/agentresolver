import { resolveGoal } from "@/lib/resolver";
import { resolveProviderRoutes } from "@/lib/providerNetwork";
import { discoverPayAiResources, type PayAiMatch } from "@/lib/payaiDiscovery";
import { discover402IndexServices, type Index402Match } from "@/lib/index402Discovery";
import {
  discoverVerifiedDomainProviderRoutes,
  fetchDomainProviderManifest,
  quoteProviderSuccessFee,
  verifyDomainProviderRouteChallenge,
  type DomainProviderRoute
} from "@/lib/providerManifest";
import { normalizeProviderSeedOrigins } from "@/lib/providerBootstrap";
import { ATTRIBUTION_HEADER, createAttributionId } from "@/lib/transactionAttribution";
import {
  ATTRIBUTION_RECEIPT_HEADER,
  issueAttributionReceipt
} from "@/lib/attributionReceiptRuntime";
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

function normalize402Index(
  match: Index402Match,
  index: number
): ProcurementCandidate {
  return {
    id: `402index:${match.sourceId}`,
    source: match.source,
    sourceRank: index + 1,
    name: match.name,
    description: match.description,
    endpoint: match.resource,
    protocol: match.protocol,
    priceUsd: match.priceUsd,
    networks: match.networks,
    inputSchema: null,
    outputSchema: null,
    sideEffect: "unknown",
    auth: match.protocol === "x402" ? "wallet" : "unknown",
    execute: {
      method: match.method,
      url: match.resource,
      protocol: match.protocol,
      priceUsd: match.priceUsd,
      paymentAsset: match.paymentAsset,
      networks: match.networks,
      spendingAuthorizationRequired: true
    },
    evidence: {
      catalog: "402index",
      category: match.category,
      healthStatus: match.healthStatus,
      reliabilityScore: match.reliabilityScore,
      domainVerified: match.domainVerified,
      paymentVerified: match.paymentVerified,
      l402Format: match.l402Format,
      lngetCompatible: match.lngetCompatible,
      relatedProtocols: match.relatedProtocols,
      lastChecked: match.lastChecked
    }
  };
}

function dedupeCandidates(candidates: ProcurementCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const endpoint = canonicalCandidateUrl(candidate.endpoint);
    const key = endpoint
      ? `${candidate.protocol}:${endpoint}`
      : candidate.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalCandidateUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function routeRelevance(goal: string, route: DomainProviderRoute) {
  const wanted = new Set(
    goal
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
  );
  const haystack = [
    route.capabilityId,
    route.name,
    route.description,
    route.providerName,
    ...route.tags
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return haystack.reduce(
    (score, token) => score + (wanted.has(token) ? 1 : 0),
    0
  );
}

function normalizeSeededDomainProvider(
  route: DomainProviderRoute,
  sourceRank: number
): ProcurementCandidate {
  const successFee = quoteProviderSuccessFee(route.amountAtomic);
  return {
    id: `domain-seed:${route.providerId}:${route.routeId}`,
    source: "agentresolver-domain-seed",
    sourceRank,
    name: route.name,
    description: route.description,
    endpoint: route.endpoint,
    protocol: "x402",
    priceUsd: route.priceUsd,
    networks: [route.network],
    inputSchema: null,
    outputSchema: null,
    sideEffect: "unknown",
    auth: "wallet",
    execute: {
      method: route.method,
      url: route.endpoint,
      protocol: "x402",
      priceUsd: route.priceUsd,
      paymentIdentity: {
        network: route.network,
        asset: route.asset,
        payTo: route.payTo,
        amountAtomic: route.amountAtomic
      },
      providerCommercialTerms: {
        model: "provider-success-fee",
        successFeeBps: route.successFeeBps,
        minimumSuccessFeeUsd: route.minimumSuccessFeeUsd,
        quotedFeeUsd: successFee.feeUsd,
        buyerPaysAgentResolverExtraFee: false
      },
      spendingAuthorizationRequired: true
    },
    evidence: {
      discovery: "caller-supplied-provider-origin",
      domainProviderEnrollment: {
        verifiedBy: "same-origin-well-known-manifest+live-x402-challenge",
        liveX402ChallengeVerified: true,
        manifestUrl: route.manifestUrl,
        origin: route.origin,
        providerId: route.providerId,
        providerName: route.providerName,
        routeId: route.routeId,
        capabilityId: route.capabilityId,
        successFeeBps: route.successFeeBps,
        minimumSuccessFeeUsd: route.minimumSuccessFeeUsd
      }
    }
  };
}

export async function discoverSeededDomainProviderCandidates(
  goal: string,
  providerOrigins: string[] | undefined,
  dependencies: {
    manifestFetcher?: typeof fetchDomainProviderManifest;
    routeVerifier?: typeof verifyDomainProviderRouteChallenge;
  } = {}
) {
  const origins = normalizeProviderSeedOrigins(providerOrigins);
  if (origins.length === 0) return [];

  const manifestFetcher =
    dependencies.manifestFetcher ?? fetchDomainProviderManifest;
  const routeVerifier =
    dependencies.routeVerifier ?? verifyDomainProviderRouteChallenge;

  const manifests = await Promise.all(
    origins.map((origin) => manifestFetcher(origin))
  );

  const relevant = manifests
    .flat()
    .map((route) => ({ route, relevance: routeRelevance(goal, route) }))
    .filter((item) => item.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);

  const verified = await Promise.all(
    relevant.map(async (item) => ({
      ...item,
      verified: await routeVerifier(item.route)
    }))
  );

  return verified
    .filter((item) => item.verified)
    .map((item, index) =>
      normalizeSeededDomainProvider(item.route, index + 1)
    );
}

async function enrichDomainProviderCandidates(
  candidates: ProcurementCandidate[]
) {
  const externalResources = candidates
    .filter(
      (candidate) =>
        candidate.protocol === "x402" &&
        candidate.source !== "agentresolver-owned" &&
        Boolean(candidate.endpoint)
    )
    .map((candidate) => candidate.endpoint as string);

  if (externalResources.length === 0) return candidates;

  const enrolled = await discoverVerifiedDomainProviderRoutes(externalResources);

  return candidates.map((candidate) => {
    const key = canonicalCandidateUrl(candidate.endpoint);
    const route = key ? enrolled.get(key) : null;
    if (!route) return candidate;

    const successFee = quoteProviderSuccessFee(route.amountAtomic);
    return {
      ...candidate,
      name: route.name,
      description: route.description,
      priceUsd: route.priceUsd,
      networks: [route.network],
      execute: {
        ...(candidate.execute || {}),
        method: route.method,
        url: route.endpoint,
        protocol: "x402",
        priceUsd: route.priceUsd,
        paymentIdentity: {
          network: route.network,
          asset: route.asset,
          payTo: route.payTo,
          amountAtomic: route.amountAtomic
        },
        providerCommercialTerms: {
          model: "provider-success-fee",
          successFeeBps: route.successFeeBps,
          minimumSuccessFeeUsd: route.minimumSuccessFeeUsd,
          quotedFeeUsd: successFee.feeUsd,
          buyerPaysAgentResolverExtraFee: false
        },
        spendingAuthorizationRequired: true
      },
      evidence: {
        ...(candidate.evidence || {}),
        domainProviderEnrollment: {
          verifiedBy: "same-origin-well-known-manifest+live-x402-challenge",
          liveX402ChallengeVerified: true,
          manifestUrl: route.manifestUrl,
          origin: route.origin,
          providerId: route.providerId,
          providerName: route.providerName,
          routeId: route.routeId,
          capabilityId: route.capabilityId,
          successFeeBps: route.successFeeBps,
          minimumSuccessFeeUsd: route.minimumSuccessFeeUsd
        }
      }
    } satisfies ProcurementCandidate;
  });
}

function domainEnrollment(
  candidate: ProcurementCandidate
): {
  manifestUrl: string;
  origin: string;
  providerId: string;
  routeId: string;
  capabilityId: string;
  successFeeBps: number;
  minimumSuccessFeeUsd: number;
} | null {
  const evidence =
    candidate.evidence &&
    typeof candidate.evidence === "object" &&
    !Array.isArray(candidate.evidence)
      ? candidate.evidence as Record<string, unknown>
      : null;
  const enrollment =
    evidence?.domainProviderEnrollment &&
    typeof evidence.domainProviderEnrollment === "object" &&
    !Array.isArray(evidence.domainProviderEnrollment)
      ? evidence.domainProviderEnrollment as Record<string, unknown>
      : null;
  if (!enrollment) return null;

  const manifestUrl = String(enrollment.manifestUrl || "");
  const origin = String(enrollment.origin || "");
  const providerId = String(enrollment.providerId || "");
  const routeId = String(enrollment.routeId || "");
  const capabilityId = String(enrollment.capabilityId || "");
  const successFeeBps = Number(enrollment.successFeeBps);
  const minimumSuccessFeeUsd = Number(enrollment.minimumSuccessFeeUsd);

  if (
    !manifestUrl ||
    !origin ||
    !providerId ||
    !routeId ||
    !capabilityId ||
    !Number.isFinite(successFeeBps) ||
    !Number.isFinite(minimumSuccessFeeUsd)
  ) return null;

  return {
    manifestUrl,
    origin,
    providerId,
    routeId,
    capabilityId,
    successFeeBps,
    minimumSuccessFeeUsd
  };
}

function attachProcurementAttribution<T extends ProcurementCandidate>(
  candidate: T,
  baseUrl: string
): T {
  const enrollment = domainEnrollment(candidate);
  if (!enrollment) return candidate;

  const execute =
    candidate.execute &&
    typeof candidate.execute === "object" &&
    !Array.isArray(candidate.execute)
      ? candidate.execute as Record<string, unknown>
      : null;
  const paymentIdentity =
    execute?.paymentIdentity &&
    typeof execute.paymentIdentity === "object" &&
    !Array.isArray(execute.paymentIdentity)
      ? execute.paymentIdentity as Record<string, unknown>
      : null;

  const attributionId = createAttributionId();
  const method =
    execute?.method === "GET" || execute?.method === "POST"
      ? execute.method
      : null;
  const url = typeof execute?.url === "string" ? execute.url : null;
  const priceUsd = Number(execute?.priceUsd);
  const network =
    typeof paymentIdentity?.network === "string"
      ? paymentIdentity.network
      : null;
  const asset =
    typeof paymentIdentity?.asset === "string"
      ? paymentIdentity.asset
      : null;
  const payTo =
    typeof paymentIdentity?.payTo === "string"
      ? paymentIdentity.payTo
      : null;
  const amountAtomic =
    typeof paymentIdentity?.amountAtomic === "string"
      ? paymentIdentity.amountAtomic
      : null;

  const signed =
    method &&
    url &&
    Number.isFinite(priceUsd) &&
    network &&
    asset &&
    payTo &&
    amountAtomic
      ? issueAttributionReceipt({
          attributionId,
          routeId: enrollment.routeId,
          providerId: enrollment.providerId,
          capabilityId: enrollment.capabilityId,
          execute: {
            method,
            url,
            priceUsd,
            network,
            asset,
            payTo,
            amountAtomic
          },
          inputFingerprint: null
        })
      : null;

  const headers =
    execute?.headers &&
    typeof execute.headers === "object" &&
    !Array.isArray(execute.headers)
      ? execute.headers as Record<string, unknown>
      : {};

  return {
    ...candidate,
    execute: {
      ...(candidate.execute || {}),
      headers: {
        ...headers,
        [ATTRIBUTION_HEADER]: attributionId,
        ...(signed
          ? { [ATTRIBUTION_RECEIPT_HEADER]: signed.receipt }
          : {})
      },
      attribution: {
        id: attributionId,
        header: ATTRIBUTION_HEADER,
        headerValue: attributionId,
        receipt: signed?.receipt ?? null,
        receiptHeader: ATTRIBUTION_RECEIPT_HEADER,
        receiptExpiresAt: signed?.payload.expiresAt ?? null,
        cryptographicallySigned: Boolean(signed),
        providerOrigin: enrollment.origin,
        providerId: enrollment.providerId,
        routeId: enrollment.routeId,
        capabilityId: enrollment.capabilityId,
        commercialModel: "provider-success-fee",
        successFeeBps: enrollment.successFeeBps,
        minimumSuccessFeeUsd: enrollment.minimumSuccessFeeUsd,
        buyerPaysAgentResolverExtraFee: false,
        conversionVerificationUrl:
          `${baseUrl}/api/provider-attribution-verify`
      }
    }
  } as T;
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
      input: { goal: string; constraints: ProcurementConstraints };
    };
  };
};

export type ProcurementOptions = {
  providerOrigins?: string[];
};

export async function procureCapability(
  goal: string,
  constraints: ProcurementConstraints,
  limit: number,
  baseUrl: string,
  options: ProcurementOptions = {}
): Promise<ProcurementResult> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 20));
  const candidateLimit = Math.min(safeLimit * 2, 10);

  const index402Protocol =
    constraints.protocol === "x402" ||
    constraints.protocol === "l402" ||
    constraints.protocol === "mpp"
      ? constraints.protocol
      : "any";

  const [resolution, partnerRoutes, payai, index402, seededProviders] = await Promise.all([
    resolveGoal(goal, undefined, candidateLimit),
    Promise.resolve(
      resolveProviderRoutes(goal, candidateLimit).filter(
        (route) => route.disclosure === "provider-partner"
      )
    ),
    constraints.protocol === "mcp"
      ? Promise.resolve([])
      : discoverPayAiResources(goal, candidateLimit),
    constraints.protocol === "mcp"
      ? Promise.resolve([])
      : discover402IndexServices(goal, candidateLimit, {
          maxPriceUsd: constraints.maxPriceUsd,
          protocol: index402Protocol
        }),
    constraints.protocol === "mcp"
      ? Promise.resolve([])
      : discoverSeededDomainProviderCandidates(
          goal,
          options.providerOrigins
        )
  ]);

  const rawCandidates = dedupeCandidates([
    ...resolution.owned.map((match) => normalizeOwned(match, baseUrl)),
    ...seededProviders,
    ...partnerRoutes.map(normalizePartner),
    ...index402.map(normalize402Index),
    ...payai.map(normalizePayAi),
    ...resolution.marketplace.map(normalizeMarketplace),
    ...resolution.mcp.map(normalizeMcp)
  ]);

  const candidates = await enrichDomainProviderCandidates(rawCandidates);
  const evaluated = rankProcurementCandidates(
    candidates,
    constraints,
    safeLimit
  );
  const selectedRaw =
    evaluated.find((candidate) => candidate.status !== "rejected") || null;
  const selected = selectedRaw
    ? attachProcurementAttribution(selectedRaw, baseUrl)
    : null;
  const returnedCandidates = selected
    ? evaluated.map((candidate) =>
        candidate.id === selected.id ? selected : candidate
      )
    : evaluated;

  return {
    selected,
    candidates: returnedCandidates,
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
              input: {
                goal,
                constraints,
                ...(options.providerOrigins && options.providerOrigins.length > 0
                  ? { providerOrigins: options.providerOrigins }
                  : {})
              }
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
