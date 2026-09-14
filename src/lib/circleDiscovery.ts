type CirclePayment = {
  scheme?: string;
  network?: string;
  asset?: string;
  amount?: string;
  payTo?: string;
};

type CircleResource = {
  resource?: string;
  type?: string;
  description?: string;
  accepts?: CirclePayment[];
  metadata?: {
    provider?: {
      name?: string;
      description?: string;
      category?: string;
    };
    description?: string;
    input?: unknown;
    supportsVanillax402?: boolean;
    supportsCircleGateway?: boolean;
  };
};

export type MarketplaceMatch = {
  source: "circle-x402";
  provider: string | null;
  category: string | null;
  description: string | null;
  resource: string;
  type: string | null;
  estimatedUsdPrice: number | null;
  accepts: CirclePayment[];
  input: unknown;
  supportsVanillax402: boolean | null;
  supportsCircleGateway: boolean | null;
};

function estimateUsdPrice(accepts: CirclePayment[] | undefined): number | null {
  const amount = accepts?.[0]?.amount;
  if (!amount || !/^\d+$/.test(amount)) return null;
  const atomic = Number(amount);
  if (!Number.isFinite(atomic)) return null;
  return atomic / 1_000_000;
}

function normalize(item: CircleResource): MarketplaceMatch | null {
  if (typeof item?.resource !== "string") return null;

  return {
    source: "circle-x402",
    provider: item.metadata?.provider?.name || null,
    category: item.metadata?.provider?.category || null,
    description:
      item.metadata?.description ||
      item.metadata?.provider?.description ||
      item.description ||
      null,
    resource: item.resource,
    type: item.type || null,
    estimatedUsdPrice: estimateUsdPrice(item.accepts),
    accepts: Array.isArray(item.accepts) ? item.accepts : [],
    input: item.metadata?.input ?? null,
    supportsVanillax402:
      typeof item.metadata?.supportsVanillax402 === "boolean"
        ? item.metadata.supportsVanillax402
        : null,
    supportsCircleGateway:
      typeof item.metadata?.supportsCircleGateway === "boolean"
        ? item.metadata.supportsCircleGateway
        : null
  };
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function scoreMatch(goal: string, item: MarketplaceMatch): number {
  const query = new Set(tokens(goal));
  if (query.size === 0) return 0;

  const haystack = tokens(
    [
      item.provider,
      item.category,
      item.description,
      item.resource,
      item.type
    ]
      .filter(Boolean)
      .join(" ")
  );

  return haystack.reduce(
    (score, token) => score + (query.has(token) ? 1 : 0),
    0
  );
}

async function getCachedCatalog(): Promise<MarketplaceMatch[]> {
  const endpoint = new URL("https://api.circle.com/v2/x402/discovery/resources");
  endpoint.searchParams.set("limit", "50");
  endpoint.searchParams.set("offset", "0");

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "AgentResolver/0.1"
      },
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 300 }
    });

    if (!response.ok) return [];

    const body = (await response.json()) as any;
    const raw: CircleResource[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.resources)
        ? body.resources
        : Array.isArray(body?.items)
          ? body.items
          : Array.isArray(body?.data)
            ? body.data
            : [];

    return raw
      .map(normalize)
      .filter((item): item is MarketplaceMatch => Boolean(item));
  } catch {
    return [];
  }
}

export async function discoverCircleResources(
  goal: string,
  limit = 5
): Promise<MarketplaceMatch[]> {
  const safeLimit = Math.max(1, Math.min(limit, 10));
  const catalog = await getCachedCatalog();

  return catalog
    .map((item) => ({ item, score: scoreMatch(goal, item) }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.item.estimatedUsdPrice ?? Number.POSITIVE_INFINITY) -
          (b.item.estimatedUsdPrice ?? Number.POSITIVE_INFINITY)
    )
    .slice(0, safeLimit)
    .map(({ item }) => item);
}
