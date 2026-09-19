type PayAiAccept = {
  scheme?: string;
  network?: string;
  asset?: string;
  amount?: string;
  payTo?: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
};

type PayAiResource = {
  resource?: string;
  serviceName?: string;
  description?: string;
  accepts?: PayAiAccept[];
  lastUpdated?: string;
};

export type PayAiMatch = {
  source: "payai-x402";
  provider: string | null;
  description: string | null;
  resource: string;
  estimatedUsdPrice: number | null;
  accepts: PayAiAccept[];
  lastUpdated: string | null;
};

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const SAFE_TERMS: Array<[RegExp, string]> = [
  [/\bsearch\b|\bresearch\b|\bweb\b/i, "search"],
  [/\bnews\b/i, "news"],
  [/\bweather\b|\bforecast\b/i, "weather"],
  [/\bmarket\b|\bprice\b|\bquote\b/i, "market"],
  [/\bcrypto\b|\bblockchain\b|\bwallet\b|\bonchain\b/i, "crypto"],
  [/\bllm\b|\bmodel\b|\binference\b|\bai\b/i, "ai"],
  [/\bcompute\b|\bgpu\b/i, "compute"],
  [/\bdata\b|\bdataset\b|\bmetrics\b|\banalytics\b/i, "data"],
  [/\bimage\b|\bvision\b/i, "image"],
  [/\bemail\b/i, "email"],
  [/\bmcp\b|\btool\b|\bapi\b|\bservice\b/i, "api"]
];

function safeTerm(goal: string): string | null {
  for (const [pattern, term] of SAFE_TERMS) {
    if (pattern.test(goal)) return term;
  }
  return null;
}

function estimateUsdPrice(accepts: PayAiAccept[]): number | null {
  for (const accept of accepts) {
    const amount = accept.amount;
    if (!amount || !/^\d+$/.test(amount)) continue;

    const asset = String(accept.asset || "");
    const network = String(accept.network || "");
    const usdc =
      (network === "eip155:8453" && asset.toLowerCase() === BASE_USDC) ||
      (network === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" && asset === SOLANA_USDC);

    if (!usdc) continue;
    const atomic = Number(amount);
    if (!Number.isFinite(atomic)) continue;
    return atomic / 1_000_000;
  }
  return null;
}

function normalize(raw: PayAiResource): PayAiMatch | null {
  const resource = typeof raw.resource === "string" ? raw.resource.trim() : "";
  if (!resource) return null;

  const accepts = Array.isArray(raw.accepts) ? raw.accepts : [];
  return {
    source: "payai-x402",
    provider:
      typeof raw.serviceName === "string" && raw.serviceName.trim()
        ? raw.serviceName.trim()
        : null,
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim()
        : null,
    resource,
    estimatedUsdPrice: estimateUsdPrice(accepts),
    accepts,
    lastUpdated:
      typeof raw.lastUpdated === "string" && raw.lastUpdated.trim()
        ? raw.lastUpdated.trim()
        : null
  };
}

export async function discoverPayAiResources(
  goal: string,
  limit = 5
): Promise<PayAiMatch[]> {
  const term = safeTerm(goal);
  if (!term) return [];

  const safeLimit = Math.max(1, Math.min(limit, 10));
  const endpoint = new URL("https://facilitator.payai.network/discovery/resources");
  endpoint.searchParams.set("q", term);
  endpoint.searchParams.set("limit", String(Math.max(safeLimit, 10)));

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "AgentResolver/0.2 procurement"
      },
      signal: AbortSignal.timeout(1800),
      next: { revalidate: 300 }
    });

    if (!response.ok) return [];
    const body = (await response.json()) as Record<string, unknown>;
    const raw = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.resources)
        ? body.resources
        : [];

    return raw
      .map((item) => normalize(item as PayAiResource))
      .filter((item): item is PayAiMatch => Boolean(item))
      .sort(
        (a, b) =>
          (a.estimatedUsdPrice ?? Number.POSITIVE_INFINITY) -
          (b.estimatedUsdPrice ?? Number.POSITIVE_INFINITY)
      )
      .slice(0, safeLimit);
  } catch {
    return [];
  }
}
