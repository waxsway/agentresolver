import { auditAgentReadiness } from "@/lib/agentReadiness";
import { inspectHttpResource } from "@/lib/httpInspect";

export type ProviderLaunchCheckInput = {
  providerId: string;
  providerName: string;
  capabilityId: string;
  name: string;
  description: string;
  origin: string;
  endpoint: string;
  method: "GET" | "POST";
  probeUrl: string;
  priceUsd: number;
  network: string;
  tags: string[];
};

function requiredText(value: unknown, field: string, max: number) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new Error(field + " is required.");
  if (result.length > max) throw new Error(field + " is too long.");
  return result;
}

function id(value: unknown, field: string, max: number) {
  const result = requiredText(value, field, max).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._:-]*$/.test(result)) {
    throw new Error(field + " must contain only lowercase letters, numbers, dot, underscore, colon, or hyphen.");
  }
  return result;
}

function publicHttps(value: unknown, field: string) {
  const raw = requiredText(value, field, 2048);
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error(field + " must be a public HTTPS URL without credentials or a custom port.");
  }
  url.hash = "";
  return url.toString();
}

export function parseProviderLaunchCheckInput(value: unknown): ProviderLaunchCheckInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Provide a JSON provider launch packet.");
  }
  const body = value as Record<string, unknown>;
  const method = body.method === undefined || body.method === "GET"
    ? "GET"
    : body.method === "POST"
      ? "POST"
      : null;
  if (!method) throw new Error("method must be GET or POST.");

  const priceUsd = Number(body.priceUsd);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0 || priceUsd > 1000) {
    throw new Error("priceUsd must be greater than 0 and no more than 1000.");
  }

  const endpoint = publicHttps(body.endpoint, "endpoint");
  const probeUrl = method === "GET"
    ? publicHttps(body.probeUrl ?? body.endpoint, "probeUrl")
    : publicHttps(body.probeUrl, "probeUrl");

  const tags = Array.isArray(body.tags)
    ? body.tags
        .map((tag) => typeof tag === "string" ? tag.trim().toLowerCase().slice(0, 80) : "")
        .filter(Boolean)
        .slice(0, 20)
    : [];

  return {
    providerId: id(body.providerId, "providerId", 80),
    providerName: requiredText(body.providerName, "providerName", 120),
    capabilityId: id(body.capabilityId, "capabilityId", 120),
    name: requiredText(body.name, "name", 160),
    description: requiredText(body.description, "description", 500),
    origin: publicHttps(body.origin, "origin"),
    endpoint,
    method,
    probeUrl,
    priceUsd,
    network: requiredText(body.network ?? "eip155:8453", "network", 120),
    tags
  };
}

function sameUsd(left: number | null, right: number) {
  return left !== null && Math.abs(left - right) < 0.0000005;
}

export async function runProviderLaunchCheck(input: ProviderLaunchCheckInput) {
  const endpointUrl = new URL(input.endpoint);
  const originUrl = new URL(input.origin);
  if (endpointUrl.origin !== originUrl.origin) {
    throw new Error("endpoint must share the declared provider origin.");
  }

  const [readiness, paymentProbe] = await Promise.all([
    auditAgentReadiness(input.origin),
    inspectHttpResource(input.probeUrl, {
      method: "GET",
      maxPriceUsd: input.priceUsd,
      expectedNetwork: input.network
    })
  ]);

  const paymentIdentityReady =
    typeof paymentProbe.x402.asset === "string" &&
    typeof paymentProbe.x402.payTo === "string" &&
    typeof paymentProbe.x402.amountAtomic === "string";

  const x402Ready =
    paymentProbe.status === 402 &&
    paymentProbe.x402.detected &&
    paymentProbe.x402.parseable &&
    paymentProbe.x402.scheme === "exact" &&
    paymentProbe.x402.network === input.network &&
    sameUsd(paymentProbe.x402.amountUsd, input.priceUsd) &&
    paymentIdentityReady;

  const eligible = x402Ready;
  const registryEntry = {
    routeId: input.providerId + ":" + input.capabilityId,
    providerId: input.providerId,
    providerName: input.providerName,
    capabilityId: input.capabilityId,
    name: input.name,
    description: input.description,
    tags: input.tags,
    endpoint: input.endpoint,
    method: input.method,
    priceUsd: input.priceUsd,
    network: input.network,
    commissionUsd: 0.001,
    paymentIdentity: x402Ready ? {
      network: paymentProbe.x402.network as string,
      asset: paymentProbe.x402.asset as string,
      payTo: paymentProbe.x402.payTo as string,
      amountAtomic: paymentProbe.x402.amountAtomic as string
    } : null,
    launchProof: {
      network: "eip155:8453",
      amountAtomic: "50000",
      payTo: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8",
      txHash: "<Base transaction hash from this launch-check PAYMENT-RESPONSE>"
    }
  };

  console.log(JSON.stringify({
    event: "provider_launch_check_completed",
    at: new Date().toISOString(),
    providerId: input.providerId,
    capabilityId: input.capabilityId,
    eligible,
    readinessScore: readiness.score,
    x402Status: paymentProbe.status,
    x402Verdict: paymentProbe.x402.verdict,
    observedPriceUsd: paymentProbe.x402.amountUsd,
    network: paymentProbe.x402.network
  }));

  return {
    product: "AgentResolver Provider Launch Check",
    paidVerification: true,
    eligibleForRegistryReview: eligible,
    decision: eligible ? "ready_for_registry_review" : "not_ready",
    provider: {
      providerId: input.providerId,
      providerName: input.providerName,
      capabilityId: input.capabilityId,
      origin: input.origin,
      endpoint: input.endpoint,
      method: input.method
    },
    readiness,
    paymentProbe: {
      url: paymentProbe.url,
      status: paymentProbe.status,
      latencyMs: paymentProbe.latencyMs,
      x402: paymentProbe.x402,
      trust: paymentProbe.trust
    },
    registryEntry,
    commercialTerms: {
      organicRankingPaid: false,
      providerSuccessFeeUsd: 0.001,
      successFeeTrigger: "AgentResolver-verified underlying buyer settlement for routes with a registered Base-USDC payment identity",
      verificationEndpoint: "https://agentresolver.vercel.app/api/provider-attribution-verify",
      settlementEndpoint: "https://agentresolver.vercel.app/api/provider-attribution-settle"
    },
    submission: {
      registryPath: "config/provider-partners.json",
      repository: "waxsway/agentresolver",
      process: "Extract the Base transaction hash from this paid call's PAYMENT-RESPONSE, replace registryEntry.launchProof.txHash, then open a pull request adding exactly that registryEntry. Registry CI checks the launch payment before operator review.",
      paymentEvidence: "Automated admission proof currently requires the $0.05 Provider Launch Check to settle on Base."
    },
    limitations: [
      "A passing launch check verifies current technical readiness and x402 payment metadata, not legal identity or future fulfillment.",
      "Passing does not guarantee listing, ranking, traffic, conversions, or agent spending authorization.",
      "Buyer-settlement verification proves payment to the registered provider payment identity; until attribution receipts are cryptographically signed, the attribution ID itself remains provider-asserted."
    ]
  };
}


export function providerLaunchReferenceInput(params: URLSearchParams): ProviderLaunchCheckInput {
  const endpoint =
    params.get("endpoint")?.trim() ||
    "https://agentresolver.vercel.app/api/x402-ping";
  const origin =
    params.get("origin")?.trim() ||
    "https://agentresolver.vercel.app";

  return parseProviderLaunchCheckInput({
    providerId: params.get("providerId") || "agentresolver-reference",
    providerName: params.get("providerName") || "AgentResolver Reference Provider",
    capabilityId: params.get("capabilityId") || "x402-ping",
    name: params.get("name") || "AgentResolver x402 Settlement Ping",
    description:
      params.get("description") ||
      "Reference x402 service used to demonstrate paid provider launch verification.",
    origin,
    endpoint,
    method: params.get("method") || "GET",
    probeUrl: params.get("probeUrl") || endpoint,
    priceUsd: params.get("priceUsd") || "0.001",
    network: params.get("network") || "eip155:8453",
    tags: params.getAll("tag").length
      ? params.getAll("tag")
      : ["x402", "provider-launch", "reference"]
  });
}
