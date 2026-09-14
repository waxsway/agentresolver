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

export async function discoverCircleResources(
  goal: string,
  limit = 5
): Promise<MarketplaceMatch[]> {
  const endpoint = new URL("https://api.circle.com/v2/x402/discovery/resources");
  endpoint.searchParams.set("query", goal);
  endpoint.searchParams.set("limit", String(Math.max(1, Math.min(limit, 10))));

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "AgentResolver/0.1"
      },
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 60 }
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
      .filter((item) => typeof item?.resource === "string")
      .slice(0, Math.max(1, Math.min(limit, 10)))
      .map((item) => ({
        source: "circle-x402" as const,
        provider: item.metadata?.provider?.name || null,
        category: item.metadata?.provider?.category || null,
        description:
          item.metadata?.description ||
          item.metadata?.provider?.description ||
          item.description ||
          null,
        resource: item.resource as string,
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
      }));
  } catch {
    return [];
  }
}
