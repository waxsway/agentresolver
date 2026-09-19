import {
  fetchDomainProviderManifest,
  verifyDomainProviderRouteChallenge,
  type DomainProviderRoute
} from "@/lib/providerManifest";
import { validatePublicHttpsUrl } from "@/lib/publicHttpsJson";

const REGISTRY_URL = "https://402index.io/api/v1/register";
const MAX_BOOTSTRAP_ROUTES = 5;
const MAX_SEED_ORIGINS = 2;

export type ProviderBootstrapInput = {
  origin: string;
  routeIds?: string[];
};

export type ProviderBootstrapOptions = {
  manifestFetcher?: (origin: string) => Promise<DomainProviderRoute[]>;
  routeVerifier?: (route: DomainProviderRoute) => Promise<boolean>;
};

export function normalizeProviderOrigin(value: string) {
  const url = validatePublicHttpsUrl(value.trim());
  if (url.pathname !== "/" || url.search) {
    throw new Error("origin must be a public HTTPS origin without a path or query.");
  }
  return url.origin;
}

function requestedRouteIds(value: string[] | undefined) {
  if (!value) return [];
  const result = [...new Set(
    value
      .map((item) => item.trim())
      .filter((item) => /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(item))
  )];
  if (result.length !== value.length || result.length > MAX_BOOTSTRAP_ROUTES) {
    throw new Error(`routeIds must contain at most ${MAX_BOOTSTRAP_ROUTES} unique valid route IDs.`);
  }
  return result;
}

function registrationPayload(route: DomainProviderRoute) {
  return {
    url: route.endpoint,
    name: route.name,
    protocol: "x402",
    http_method: route.method,
    ...(route.method === "POST" ? { probe_body: "{}" } : {}),
    description: route.description,
    price_usd: route.priceUsd,
    payment_asset: "USDC",
    payment_network: "Base",
    category: route.tags[0] || "agent-service",
    provider: route.providerName
  };
}

export async function buildProviderBootstrap(
  input: ProviderBootstrapInput,
  options: ProviderBootstrapOptions = {}
) {
  const origin = normalizeProviderOrigin(input.origin);
  const wanted = requestedRouteIds(input.routeIds);
  const manifestFetcher =
    options.manifestFetcher ?? fetchDomainProviderManifest;
  const routeVerifier =
    options.routeVerifier ?? verifyDomainProviderRouteChallenge;

  const routes = await manifestFetcher(origin);
  if (routes.length === 0) {
    throw new Error(
      "No valid AgentResolver provider manifest was found at the origin."
    );
  }

  const selected = (wanted.length > 0
    ? wanted.map((id) => routes.find((route) => route.routeId === id) ?? null)
    : routes.slice(0, MAX_BOOTSTRAP_ROUTES)
  ).filter((route): route is DomainProviderRoute => Boolean(route));

  if (wanted.length > 0 && selected.length !== wanted.length) {
    throw new Error("One or more requested routeIds are not present in the provider manifest.");
  }

  const checks = await Promise.all(
    selected.map(async (route) => ({
      route,
      verified: await routeVerifier(route)
    }))
  );

  const verified = checks.filter((item) => item.verified);
  const rejected = checks.filter((item) => !item.verified);

  return {
    schemaVersion: 1,
    service: "AgentResolver Provider Bootstrap",
    origin,
    manifestUrl: routes[0]!.manifestUrl,
    provider: {
      id: routes[0]!.providerId,
      name: routes[0]!.providerName
    },
    manifestRouteCount: routes.length,
    checkedRouteCount: checks.length,
    truncated: wanted.length === 0 && routes.length > MAX_BOOTSTRAP_ROUTES,
    verifiedRoutes: verified.map(({ route }) => ({
      routeId: route.routeId,
      capabilityId: route.capabilityId,
      name: route.name,
      description: route.description,
      tags: route.tags,
      endpoint: route.endpoint,
      method: route.method,
      priceUsd: route.priceUsd,
      payment: {
        network: route.network,
        asset: route.asset,
        payTo: route.payTo,
        amountAtomic: route.amountAtomic
      },
      providerCommercialTerms: {
        model: "provider-success-fee",
        successFeeBps: route.successFeeBps,
        minimumSuccessFeeUsd: route.minimumSuccessFeeUsd,
        buyerExtraFeeUsd: 0
      },
      durableDiscoveryBootstrap: {
        registry: "402 Index",
        registrationSentByAgentResolver: false,
        callerActionRequired: true,
        externalReviewMayApply: true,
        action: {
          method: "POST",
          url: REGISTRY_URL,
          headers: {
            "content-type": "application/json"
          },
          body: registrationPayload(route)
        },
        note:
          "The provider or its agent sends this anonymous registration directly. 402 Index independently probes/reviews the route. Once accepted, AgentResolver can discover it through its existing 402 Index supply ingestion."
      }
    })),
    rejectedRoutes: rejected.map(({ route }) => ({
      routeId: route.routeId,
      reason: "live_x402_challenge_did_not_match_manifest"
    })),
    immediateProcurement: {
      rest: {
        method: "POST",
        url: "https://agentresolver.vercel.app/api/procure",
        addToRequest: {
          providerOrigins: [origin]
        }
      },
      mcp: {
        server: "https://agentresolver.vercel.app/mcp/control",
        tool: "procure",
        addToArguments: {
          providerOrigins: [origin]
        }
      }
    },
    boundaries: {
      accountRequiredByAgentResolver: false,
      emailRequiredByAgentResolver: false,
      operatorReviewRequiredByAgentResolver: false,
      AgentResolverPersistsProviderState: false,
      AgentResolverSendsRegistryRegistration: false,
      AgentResolverAuthorizesProviderOrBuyerSpend: false,
      arbitraryProxying: false,
      walletKeysAccepted: false,
      paymentSignaturesSent: false
    }
  } as const;
}

export const PROVIDER_BOOTSTRAP_MAX_ROUTES = MAX_BOOTSTRAP_ROUTES;


export function normalizeProviderSeedOrigins(values: string[] | undefined) {
  if (!values) return [];
  if (values.length > MAX_SEED_ORIGINS) {
    throw new Error(`providerOrigins supports at most ${MAX_SEED_ORIGINS} origins.`);
  }

  const origins = [...new Set(values.map(normalizeProviderOrigin))];
  if (origins.length !== values.length) {
    throw new Error("providerOrigins must contain unique public HTTPS origins.");
  }
  return origins;
}

export const PROVIDER_SEED_MAX_ORIGINS = MAX_SEED_ORIGINS;
