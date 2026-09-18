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

  const x402Ready =
    paymentProbe.status === 402 &&
    paymentProbe.x402.detected &&
    paymentProbe.x402.parseable &&
    paymentProbe.x402.scheme === "exact" &&
    paymentProbe.x402.network === input.network &&
    sameUsd(paymentProbe.x402.amountUsd, input.priceUsd);

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
    commissionUsd: 0.001
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
      successFeeTrigger: "provider-reported fulfilled attribution",
      settlementEndpoint: "https://agentresolver.vercel.app/api/provider-attribution-settle"
    },
    submission: {
      registryPath: "config/provider-partners.json",
      repository: "waxsway/agentresolver",
      process: "Open a pull request adding exactly the returned registryEntry. AgentResolver reviews provider routes before activation.",
      paymentEvidence: "Retain the x402 PAYMENT-RESPONSE from this paid launch check with the submission."
    },
    limitations: [
      "A passing launch check verifies current technical readiness and x402 payment metadata, not legal identity or future fulfillment.",
      "Passing does not guarantee listing, ranking, traffic, conversions, or agent spending authorization."
    ]
  };
}
