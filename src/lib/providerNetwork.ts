import { CANONICAL_ORIGIN, getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import { attributionSigningConfigured } from "@/lib/attributionReceiptRuntime";
import providerPartnersJson from "../../config/provider-partners.json";

export type ProviderRoute = Readonly<{
  routeId: string;
  providerId: string;
  providerName: string;
  capabilityId: string;
  name: string;
  description: string;
  tags: string[];
  disclosure: "first-party" | "provider-partner";
  sponsored: false;
  execute: Readonly<{
    kind: "x402-handoff";
    method: "GET" | "POST";
    url: string;
    priceUsd: number;
    asset: "USDC";
    networks: string[];
    paymentIdentity: Readonly<{
      network: string;
      asset: string;
      payTo: string;
      amountAtomic: string;
    }> | null;
  }>;
  funding: Readonly<{
    model: "first-party-revenue" | "provider-success-fee";
    feeUsd: number | null;
    settlementEndpoint: string | null;
    dueWhen: string | null;
  }>;
}>;

type PartnerConfig = {
  routeId?: unknown;
  providerId?: unknown;
  providerName?: unknown;
  capabilityId?: unknown;
  name?: unknown;
  description?: unknown;
  tags?: unknown;
  endpoint?: unknown;
  method?: unknown;
  priceUsd?: unknown;
  network?: unknown;
  commissionUsd?: unknown;
  launchProof?: unknown;
  paymentIdentity?: unknown;
};

type PaymentIdentityConfig = {
  network?: unknown;
  asset?: unknown;
  payTo?: unknown;
  amountAtomic?: unknown;
};

type LaunchProof = {
  network?: unknown;
  amountAtomic?: unknown;
  payTo?: unknown;
  txHash?: unknown;
};

const FIRST_PARTY_IDS: PaidCapabilityId[] = [
  "x402-ping",
  "x402-payment-preflight",
  "x402-settlement-verify",
  "verified-resolve",
  "batch-verified-resolve",
  "provider-launch-check"
];

const BASE = "eip155:8453";
const SOLANA = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const PROVIDER_SETTLEMENT = CANONICAL_ORIGIN + "/api/provider-attribution-settle";

function paidMethod(id: PaidCapabilityId): "GET" | "POST" {
  return id === "x402-ping" || id === "x402-payment-preflight" || id === "x402-settlement-verify"
    ? "GET"
    : "POST";
}

function firstPartyRoutes(): ProviderRoute[] {
  return FIRST_PARTY_IDS.map((id) => {
    const product = getPaidCapability(id);
    return {
      routeId: "agentresolver:" + id,
      providerId: "agentresolver",
      providerName: "AgentResolver",
      capabilityId: id,
      name: product.name,
      description: product.description,
      tags: [...product.tags],
      disclosure: "first-party" as const,
      sponsored: false as const,
      execute: {
        kind: "x402-handoff" as const,
        method: paidMethod(id),
        url: CANONICAL_ORIGIN + product.endpoint,
        priceUsd: product.priceUsd,
        asset: "USDC" as const,
        networks: [BASE, SOLANA],
        paymentIdentity: null
      },
      funding: {
        model: "first-party-revenue" as const,
        feeUsd: null,
        settlementEndpoint: null,
        dueWhen: null
      }
    };
  });
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeHttps(value: unknown): string | null {
  const raw = text(value, 2048);
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function validLaunchProof(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proof = value as LaunchProof;
  return (
    proof.network === "eip155:8453" &&
    proof.amountAtomic === "50000" &&
    typeof proof.payTo === "string" &&
    proof.payTo.toLowerCase() === "0x66e19457ffc829e8ed74706f5c1399c6f6466de8" &&
    typeof proof.txHash === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(proof.txHash)
  );
}

function parsePaymentIdentity(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const identity = value as PaymentIdentityConfig;
  const network = text(identity.network, 120);
  const asset = text(identity.asset, 128);
  const payTo = text(identity.payTo, 128);
  const amountAtomic = text(identity.amountAtomic, 78);
  if (!network || !asset || !payTo || !/^[0-9]+$/.test(amountAtomic)) return null;
  return { network, asset, payTo, amountAtomic };
}

function parsePartnerRoutes(parsed: unknown, requireLaunchProof = false): ProviderRoute[] {
  if (!Array.isArray(parsed)) return [];

  const routes: ProviderRoute[] = [];
  for (const item of parsed.slice(0, 50)) {
    if (!item || typeof item !== "object") continue;
    const config = item as PartnerConfig;
    const routeId = text(config.routeId, 100);
    const providerId = text(config.providerId, 80);
    const providerName = text(config.providerName, 120);
    const capabilityId = text(config.capabilityId, 120);
    const name = text(config.name, 160);
    const description = text(config.description, 500);
    const endpoint = safeHttps(config.endpoint);
    const method = text(config.method, 8).toUpperCase();
    const priceUsd = Number(config.priceUsd);
    const network = text(config.network, 120) || BASE;
    const commissionUsd = Number(config.commissionUsd);
    const paymentIdentity = parsePaymentIdentity(config.paymentIdentity);

    if (
      !routeId ||
      routeId.startsWith("agentresolver:") ||
      !providerId ||
      providerId === "agentresolver" ||
      !providerName ||
      !capabilityId ||
      !name ||
      !description ||
      !endpoint ||
      (method !== "GET" && method !== "POST") ||
      !Number.isFinite(priceUsd) ||
      priceUsd < 0 ||
      priceUsd > 1000 ||
      !Number.isFinite(commissionUsd) ||
      commissionUsd !== 0.001 ||
      (requireLaunchProof && !validLaunchProof(config.launchProof))
    ) continue;

    const tags = Array.isArray(config.tags)
      ? config.tags.map((tag) => text(tag, 80).toLowerCase()).filter(Boolean).slice(0, 20)
      : [];

    routes.push({
      routeId,
      providerId,
      providerName,
      capabilityId,
      name,
      description,
      tags,
      disclosure: "provider-partner",
      sponsored: false,
      execute: {
        kind: "x402-handoff",
        method,
        url: endpoint,
        priceUsd,
        asset: "USDC",
        networks: [network],
        paymentIdentity
      },
      funding: {
        model: "provider-success-fee",
        feeUsd: 0.001,
        settlementEndpoint: PROVIDER_SETTLEMENT,
        dueWhen: paymentIdentity
          ? "after_agentresolver_verifies_the_underlying_buyer_settlement"
          : "after_provider_reports_the_attributed_request_as_fulfilled"
      }
    });
  }
  return routes;
}

function environmentPartnerRoutes(
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const raw = env.AGENTRESOLVER_PROVIDER_REGISTRY_JSON?.trim();
  if (!raw || raw.length > 20_000) return [];
  try {
    return parsePartnerRoutes(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function registeredProviderRoutes(
  env: Readonly<Record<string, string | undefined>> = process.env
): ProviderRoute[] {
  const staticRoutes = parsePartnerRoutes(providerPartnersJson as unknown, true);
  const envRoutes = environmentPartnerRoutes(env);
  const seen = new Set<string>();
  return [...firstPartyRoutes(), ...staticRoutes, ...envRoutes].filter((route) => {
    if (seen.has(route.routeId)) return false;
    seen.add(route.routeId);
    return true;
  });
}

function tokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function resolveProviderRoutes(
  goal: string,
  limit = 5,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const wanted = new Set(tokens(goal));
  return registeredProviderRoutes(env)
    .map((route) => {
      const haystack = new Set(tokens(
        route.name + " " + route.description + " " + route.tags.join(" ") + " " + route.capabilityId
      ));
      const overlap = [...haystack].reduce(
        (score, token) => score + (wanted.has(token) ? 1 : 0),
        0
      );
      const phraseBonus = route.tags.some((tag) => goal.toLowerCase().includes(tag)) ? 3 : 0;
      return { route, score: overlap + phraseBonus };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.route.execute.priceUsd - b.route.execute.priceUsd)
    .slice(0, Math.max(1, Math.min(limit, 10)))
    .map(({ route, score }, index) => ({ rank: index + 1, score, ...route }));
}

export function getProviderRoute(
  routeId: string,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  return registeredProviderRoutes(env).find((route) => route.routeId === routeId) ?? null;
}

export function getProviderRouteByCapability(
  capabilityId: string,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  return registeredProviderRoutes(env).find((route) => route.capabilityId === capabilityId) ?? null;
}

export function providerNetworkSnapshot(
  baseUrl: string = CANONICAL_ORIGIN,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const routes = registeredProviderRoutes(env);
  const partnerCount = routes.filter((route) => route.disclosure === "provider-partner").length;
  return {
    schemaVersion: 1,
    service: "AgentResolver Provider Network",
    mode: "registered_handoff_only",
    arbitraryProxying: false,
    callerSpendingAuthorized: false,
    routes,
    counts: {
      routes: routes.length,
      firstParty: routes.length - partnerCount,
      providerPartners: partnerCount
    },
    providerFunding: {
      status: "pilot_open",
      feeModel: "provider_success_fee",
      feeUsd: 0.001,
      trigger: "verified buyer settlement when provider payment identity is registered; legacy provider-reported fulfillment otherwise",
      settlement: baseUrl.replace(/\/$/, "") + "/api/provider-attribution-settle",
      attributionProof: {
        signingConfigured: attributionSigningConfigured(env),
        signedReceiptHeader: "x-agentresolver-attribution-receipt",
        signingScheme: "HMAC-SHA256",
        receiptFormat: "ar1",
        failClosedWhenConfigured: true
      },
      proofScope: attributionSigningConfigured(env)
        ? "For routes with a registered Base-USDC payment identity, AgentResolver can independently verify the buyer settlement and require a matching signed procurement handoff receipt before the provider pays the success fee."
        : "For routes with a registered Base-USDC payment identity, AgentResolver can independently verify the buyer settlement. Attribution remains explicitly legacy/provider-asserted until the dedicated attribution signing secret is configured."
    },
    routing: {
      resolve: baseUrl.replace(/\/$/, "") + "/api/resolve",
      execute: baseUrl.replace(/\/$/, "") + "/api/execute",
      behavior:
        "The execution router returns an allowlisted provider handoff contract. It never forwards wallet keys, payment signatures, cookies, or authorization headers and never authorizes target spend."
    }
  };
}
