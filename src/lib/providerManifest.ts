import { createHash } from "node:crypto";
import { inspectHttpResource } from "@/lib/httpInspect";
import { fetchPublicJson, validatePublicHttpsUrl } from "@/lib/publicHttpsJson";
import { BASE_NETWORK, BASE_USDC } from "@/lib/x402SettlementVerify";

export const PROVIDER_MANIFEST_PATH =
  "/.well-known/agentresolver-provider.json" as const;
export const PROVIDER_MANIFEST_MAX_BYTES = 32_000 as const;
export const PROVIDER_SUCCESS_FEE_BPS = 200 as const;
export const PROVIDER_SUCCESS_FEE_MIN_USD = 0.001 as const;

type JsonObject = Record<string, unknown>;

export type DomainProviderRoute = Readonly<{
  manifestUrl: string;
  origin: string;
  providerId: string;
  providerName: string;
  routeId: string;
  capabilityId: string;
  name: string;
  description: string;
  tags: string[];
  endpoint: string;
  method: "GET" | "POST";
  priceUsd: number;
  network: typeof BASE_NETWORK;
  asset: typeof BASE_USDC;
  payTo: string;
  amountAtomic: string;
  successFeeBps: typeof PROVIDER_SUCCESS_FEE_BPS;
  minimumSuccessFeeUsd: typeof PROVIDER_SUCCESS_FEE_MIN_USD;
}>;

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeId(value: unknown, max: number) {
  const result = text(value, max);
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(result) ? result : "";
}

function normalizedUrl(value: unknown): string | null {
  const raw = text(value, 2_048);
  if (!raw) return null;
  try {
    const url = validatePublicHttpsUrl(raw);
    return url.toString();
  } catch {
    return null;
  }
}

function sameOrigin(left: string, right: string) {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

function canonicalUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

function withinManifestSize(raw: unknown) {
  try {
    const serialized = JSON.stringify(raw);
    return (
      typeof serialized === "string" &&
      Buffer.byteLength(serialized, "utf8") <= PROVIDER_MANIFEST_MAX_BYTES
    );
  } catch {
    return false;
  }
}

export function parseDomainProviderManifest(
  manifestUrl: string,
  raw: unknown
): DomainProviderRoute[] {
  if (!withinManifestSize(raw)) return [];

  let manifestOrigin = "";
  try {
    const manifest = validatePublicHttpsUrl(manifestUrl);
    if (manifest.pathname !== PROVIDER_MANIFEST_PATH) return [];
    manifestOrigin = manifest.origin;
  } catch {
    return [];
  }

  const root = object(raw);
  if (!root || root.schemaVersion !== 1) return [];

  const provider = object(root.provider);
  const commercial = object(root.commercial);
  const providerId = safeId(provider?.id, 80);
  const providerName = text(provider?.name, 120);
  const successFeeBps = Number(commercial?.successFeeBps);
  const minimumSuccessFeeUsd = Number(commercial?.minimumSuccessFeeUsd);

  if (
    !providerId ||
    !providerName ||
    successFeeBps !== PROVIDER_SUCCESS_FEE_BPS ||
    minimumSuccessFeeUsd !== PROVIDER_SUCCESS_FEE_MIN_USD
  ) {
    return [];
  }

  const routes = Array.isArray(root.routes) ? root.routes.slice(0, 25) : [];
  const parsed: DomainProviderRoute[] = [];

  for (const value of routes) {
    const route = object(value);
    if (!route) continue;

    const routeId = safeId(route.routeId, 100);
    const capabilityId = safeId(route.capabilityId, 120);
    const name = text(route.name, 160);
    const description = text(route.description, 500);
    const endpoint = normalizedUrl(route.endpoint);
    const method =
      route.method === "POST" ? "POST" : route.method === "GET" ? "GET" : null;
    const priceUsd = Number(route.priceUsd);
    const payment = object(route.payment);
    const network = text(payment?.network, 120);
    const asset = text(payment?.asset, 128);
    const payTo = text(payment?.payTo, 128);
    const amountAtomic = text(payment?.amountAtomic, 78);

    if (
      !routeId ||
      !routeId.startsWith(`${providerId}:`) ||
      !capabilityId ||
      !name ||
      !description ||
      !endpoint ||
      !sameOrigin(endpoint, manifestOrigin) ||
      !method ||
      !Number.isFinite(priceUsd) ||
      priceUsd <= 0 ||
      priceUsd > 1000 ||
      network !== BASE_NETWORK ||
      asset.toLowerCase() !== BASE_USDC.toLowerCase() ||
      !/^0x[0-9a-fA-F]{40}$/.test(payTo) ||
      !/^[0-9]{1,78}$/.test(amountAtomic)
    ) {
      continue;
    }

    const amount = Number(amountAtomic);
    if (!Number.isSafeInteger(amount) || amount <= 0) continue;
    const expectedPrice = amount / 1_000_000;
    if (Math.abs(expectedPrice - priceUsd) > 0.0000005) continue;

    const tags = Array.isArray(route.tags)
      ? route.tags
          .map((tag) => text(tag, 80).toLowerCase())
          .filter(Boolean)
          .slice(0, 20)
      : [];

    parsed.push({
      manifestUrl,
      origin: manifestOrigin,
      providerId,
      providerName,
      routeId,
      capabilityId,
      name,
      description,
      tags,
      endpoint,
      method,
      priceUsd,
      network: BASE_NETWORK,
      asset: BASE_USDC,
      payTo,
      amountAtomic,
      successFeeBps: PROVIDER_SUCCESS_FEE_BPS,
      minimumSuccessFeeUsd: PROVIDER_SUCCESS_FEE_MIN_USD
    });
  }

  return parsed;
}

export function providerManifestUrlForResource(resourceUrl: string) {
  const resource = validatePublicHttpsUrl(resourceUrl);
  return `${resource.origin}${PROVIDER_MANIFEST_PATH}`;
}

export async function fetchDomainProviderManifest(
  resourceUrl: string
): Promise<DomainProviderRoute[]> {
  const manifestUrl = providerManifestUrlForResource(resourceUrl);

  try {
    const response = await fetchPublicJson(manifestUrl, {
      timeoutMs: 1_200,
      maxBytes: PROVIDER_MANIFEST_MAX_BYTES
    });
    if (response.status !== 200) return [];
    return parseDomainProviderManifest(manifestUrl, response.json);
  } catch {
    return [];
  }
}

export async function discoverDomainProviderRoute(
  resourceUrl: string
): Promise<DomainProviderRoute | null> {
  const target = canonicalUrl(resourceUrl);
  const routes = await fetchDomainProviderManifest(resourceUrl);
  return routes.find((route) => canonicalUrl(route.endpoint) === target) ?? null;
}

export async function discoverDomainProviderRoutes(
  resourceUrls: string[]
): Promise<Map<string, DomainProviderRoute>> {
  const uniqueOrigins = new Map<string, string>();

  for (const resourceUrl of resourceUrls.slice(0, 10)) {
    try {
      const url = validatePublicHttpsUrl(resourceUrl);
      if (!uniqueOrigins.has(url.origin)) {
        uniqueOrigins.set(url.origin, resourceUrl);
      }
    } catch {
      // Ignore invalid external catalog entries.
    }
    if (uniqueOrigins.size >= 5) break;
  }

  const manifests = await Promise.all(
    [...uniqueOrigins.values()].map((resourceUrl) =>
      fetchDomainProviderManifest(resourceUrl)
    )
  );

  const result = new Map<string, DomainProviderRoute>();
  for (const routes of manifests) {
    for (const route of routes) {
      result.set(canonicalUrl(route.endpoint), route);
    }
  }
  return result;
}

export function domainProviderChallengeMatches(
  route: DomainProviderRoute,
  report: Awaited<ReturnType<typeof inspectHttpResource>>
) {
  const challenge = report.x402;
  let resourceMatches = false;

  if (challenge.resource) {
    try {
      resourceMatches =
        canonicalUrl(challenge.resource) === canonicalUrl(route.endpoint);
    } catch {
      resourceMatches = false;
    }
  }

  return Boolean(
    report.status === 402 &&
    challenge.detected === true &&
    challenge.challengeHeaderPresent === true &&
    challenge.parseable === true &&
    challenge.version === 2 &&
    challenge.acceptCount > 0 &&
    challenge.scheme === "exact" &&
    challenge.network === route.network &&
    challenge.asset?.toLowerCase() === route.asset.toLowerCase() &&
    challenge.payTo?.toLowerCase() === route.payTo.toLowerCase() &&
    challenge.amountAtomic === route.amountAtomic &&
    resourceMatches
  );
}

export async function verifyDomainProviderRouteChallenge(
  route: DomainProviderRoute,
  inspector: typeof inspectHttpResource = inspectHttpResource
) {
  try {
    const report = await inspector(
      route.endpoint,
      route.method === "POST"
        ? {
            method: "POST",
            allowUnpaidPostProbe: true,
            body: {}
          }
        : { method: "GET" }
    );
    return domainProviderChallengeMatches(route, report);
  } catch {
    return false;
  }
}

export async function discoverVerifiedDomainProviderRoutes(
  resourceUrls: string[],
  verifier: (
    route: DomainProviderRoute
  ) => Promise<boolean> = verifyDomainProviderRouteChallenge
): Promise<Map<string, DomainProviderRoute>> {
  const requested = new Set<string>();

  for (const resourceUrl of resourceUrls.slice(0, 10)) {
    try {
      requested.add(canonicalUrl(validatePublicHttpsUrl(resourceUrl).toString()));
    } catch {
      // Invalid/private/local targets are never eligible for provider enrollment.
    }
  }

  const enrolled = await discoverDomainProviderRoutes(resourceUrls);
  const matching = [...enrolled.entries()].filter(([endpoint]) =>
    requested.has(endpoint)
  );

  const verified = await Promise.all(
    matching.map(async ([endpoint, route]) => ({
      endpoint,
      route,
      accepted: await verifier(route)
    }))
  );

  const result = new Map<string, DomainProviderRoute>();
  for (const item of verified) {
    if (item.accepted) result.set(item.endpoint, item.route);
  }
  return result;
}

function attributionBindingAtomic(attributionId: string | undefined) {
  if (!attributionId) return 0n;
  const digest = createHash("sha256").update(attributionId).digest();
  return BigInt(digest.readUInt16BE(0) % 100);
}

export function quoteProviderSuccessFee(
  amountAtomic: string,
  attributionId?: string
) {
  if (!/^[0-9]{1,78}$/.test(amountAtomic)) {
    throw new Error("amountAtomic must be a base-10 USDC atomic amount.");
  }

  const gross = BigInt(amountAtomic);
  if (gross <= 0n) {
    throw new Error("amountAtomic must be positive.");
  }

  const basisPoints = BigInt(PROVIDER_SUCCESS_FEE_BPS);
  const denominator = 10_000n;
  const percentageAtomic =
    (gross * basisPoints + denominator - 1n) / denominator;
  const minimumAtomic = 1_000n;
  const baseFeeAtomic = percentageAtomic > minimumAtomic
    ? percentageAtomic
    : minimumAtomic;
  const bindingAtomic = attributionBindingAtomic(attributionId);
  const feeAtomic = baseFeeAtomic + bindingAtomic;

  return {
    grossAmountAtomic: gross.toString(),
    successFeeBps: PROVIDER_SUCCESS_FEE_BPS,
    minimumFeeAtomic: minimumAtomic.toString(),
    baseFeeAmountAtomic: baseFeeAtomic.toString(),
    attributionBindingAtomic: bindingAtomic.toString(),
    attributionBound: Boolean(attributionId),
    feeAmountAtomic: feeAtomic.toString(),
    grossUsd: Number(gross) / 1_000_000,
    feeUsd: Number(feeAtomic) / 1_000_000
  } as const;
}
