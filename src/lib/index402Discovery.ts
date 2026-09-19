export type Index402Protocol = "x402" | "l402" | "mpp";

type Index402RawService = {
  id?: string | number;
  name?: string;
  description?: string;
  url?: string;
  protocol?: string;
  price_usd?: number | string | null;
  payment_asset?: string | null;
  payment_network?: string | null;
  category?: string | null;
  provider?: string | null;
  source?: string | null;
  health_status?: string | null;
  probe_status?: string | null;
  uptime_30d?: number | string | null;
  latency_p50_ms?: number | string | null;
  last_checked?: string | null;
  http_method?: string | null;
  reliability_score?: number | string | null;
  x402_payment_valid?: number | boolean | null;
  domain_verified?: number | boolean | null;
  l402_format?: string | null;
  lnget_compatible?: number | boolean | null;
  related_protocols?: string[] | null;
};

export type Index402Match = {
  source: "402index";
  sourceId: string;
  provider: string | null;
  name: string;
  description: string | null;
  resource: string;
  protocol: Index402Protocol;
  priceUsd: number | null;
  paymentAsset: string | null;
  networks: string[];
  category: string | null;
  method: string | null;
  healthStatus: string | null;
  reliabilityScore: number | null;
  domainVerified: boolean;
  paymentVerified: boolean;
  l402Format: string | null;
  lngetCompatible: boolean | null;
  relatedProtocols: string[];
  lastChecked: string | null;
};

export type Index402DiscoveryOptions = {
  maxPriceUsd?: number;
  protocol?: "x402" | "l402" | "mpp" | "any";
};

function numberOrNull(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function protocol(value: unknown): Index402Protocol | null {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "x402" ||
    normalized === "l402" ||
    normalized === "mpp"
    ? normalized
    : null;
}

function network(value: string | null | undefined): string[] {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const normalized = raw.toLowerCase();

  if (normalized === "base" || normalized === "base mainnet") {
    return ["eip155:8453"];
  }
  if (normalized === "solana" || normalized === "solana mainnet") {
    return ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"];
  }
  if (normalized === "lightning" || normalized === "bitcoin lightning") {
    return ["lightning"];
  }
  return [raw];
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalize(raw: Index402RawService): Index402Match | null {
  const resource = httpsUrl(raw.url);
  const normalizedProtocol = protocol(raw.protocol);
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 200) : "";

  if (!resource || !normalizedProtocol || !name) return null;

  const method = typeof raw.http_method === "string"
    ? raw.http_method.trim().toUpperCase()
    : null;

  return {
    source: "402index",
    sourceId: String(raw.id ?? resource),
    provider:
      typeof raw.provider === "string" && raw.provider.trim()
        ? raw.provider.trim().slice(0, 200)
        : null,
    name,
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim().slice(0, 2_000)
        : null,
    resource,
    protocol: normalizedProtocol,
    priceUsd: numberOrNull(raw.price_usd),
    paymentAsset:
      typeof raw.payment_asset === "string" && raw.payment_asset.trim()
        ? raw.payment_asset.trim()
        : null,
    networks: network(raw.payment_network),
    category:
      typeof raw.category === "string" && raw.category.trim()
        ? raw.category.trim()
        : null,
    method,
    healthStatus:
      typeof raw.health_status === "string" ? raw.health_status : null,
    reliabilityScore: numberOrNull(raw.reliability_score),
    domainVerified: bool(raw.domain_verified),
    paymentVerified:
      normalizedProtocol === "x402"
        ? bool(raw.x402_payment_valid)
        : raw.health_status === "healthy",
    l402Format:
      typeof raw.l402_format === "string" ? raw.l402_format : null,
    lngetCompatible:
      raw.lnget_compatible == null ? null : bool(raw.lnget_compatible),
    relatedProtocols: Array.isArray(raw.related_protocols)
      ? raw.related_protocols
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 8)
      : [],
    lastChecked:
      typeof raw.last_checked === "string" ? raw.last_checked : null
  };
}

export async function discover402IndexServices(
  goal: string,
  limit = 5,
  options: Index402DiscoveryOptions = {}
): Promise<Index402Match[]> {
  const query = goal.trim().slice(0, 200);
  if (!query) return [];

  const safeLimit = Math.max(1, Math.min(limit, 10));
  const endpoint = new URL("https://402index.io/api/v1/services");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("verified", "true");
  endpoint.searchParams.set("limit", String(Math.max(10, safeLimit)));

  if (
    typeof options.maxPriceUsd === "number" &&
    Number.isFinite(options.maxPriceUsd) &&
    options.maxPriceUsd >= 0
  ) {
    endpoint.searchParams.set("max_price_usd", String(options.maxPriceUsd));
  }
  if (
    options.protocol &&
    options.protocol !== "any" &&
    (options.protocol === "x402" ||
      options.protocol === "l402" ||
      options.protocol === "mpp")
  ) {
    endpoint.searchParams.set("protocol", options.protocol);
  }

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "AgentResolver/0.3 procurement"
      },
      signal: AbortSignal.timeout(1_800),
      next: { revalidate: 300 }
    });

    if (!response.ok) return [];

    const body = (await response.json()) as Record<string, unknown>;
    const services = Array.isArray(body.services) ? body.services : [];

    return services
      .map((item) => normalize(item as Index402RawService))
      .filter((item): item is Index402Match => Boolean(item))
      .sort((a, b) => {
        const domainDelta = Number(b.domainVerified) - Number(a.domainVerified);
        if (domainDelta !== 0) return domainDelta;
        const reliabilityDelta =
          (b.reliabilityScore ?? 0) - (a.reliabilityScore ?? 0);
        if (reliabilityDelta !== 0) return reliabilityDelta;
        return (
          (a.priceUsd ?? Number.POSITIVE_INFINITY) -
          (b.priceUsd ?? Number.POSITIVE_INFINITY)
        );
      })
      .slice(0, safeLimit);
  } catch {
    return [];
  }
}
