import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { resolveGoal } from "@/lib/resolver";
import { getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import {
  callerHash,
  classifyIntent,
  referrerHost,
  safeUserAgent,
  shortHash,
  logPaidCapabilityAttempt,
  logX402Settlement
} from "@/lib/telemetry";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_PRICING } from "@/lib/x402Config";

export const dynamic = "force-dynamic";

const MAX_GOAL_LENGTH = 1000;
const MAX_URL_LENGTH = 2048;

function formatUsd(value: number) {
  return value < 0.01 ? value.toFixed(3) : value.toFixed(2);
}

type PaidRecommendation = {
  capabilityId: PaidCapabilityId;
  reason: string;
  method: "POST";
  execute: string;
  priceUsd: number;
  asset: "USDC";
  network: "eip155:8453";
  protocol: "x402";
  spendingAuthorizationRequired: true;
  input?: Record<string, unknown>;
};

function paidRecommendation(
  baseUrl: string,
  capabilityId: PaidCapabilityId,
  reason: string,
  input?: Record<string, unknown>
): PaidRecommendation {
  const product = getPaidCapability(capabilityId);
  return {
    capabilityId,
    reason,
    method: "POST",
    execute: `${baseUrl}${product.endpoint}`,
    priceUsd: product.priceUsd,
    asset: "USDC",
    network: "eip155:8453",
    protocol: "x402",
    spendingAuthorizationRequired: true,
    ...(input ? { input } : {})
  };
}

async function resolveHandler(req: NextRequest): Promise<NextResponse<unknown>> {
  const body = (await req.json().catch(() => null)) as
    | { goal?: unknown; url?: unknown; limit?: unknown }
    | null;
  const goal = String(body?.goal || "").trim();
  const url = typeof body?.url === "string" ? body.url.trim() : undefined;
  const parsedLimit = Number(body?.limit || 3);
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 10)) : 3;

  if (!goal) return NextResponse.json({ error: "MISSING_GOAL", message: "Provide a natural-language goal." }, { status: 400 });
  if (goal.length > MAX_GOAL_LENGTH) return NextResponse.json({ error: "GOAL_TOO_LONG", message: `Goal must be ${MAX_GOAL_LENGTH} characters or fewer.` }, { status: 400 });
  if (url && url.length > MAX_URL_LENGTH) return NextResponse.json({ error: "URL_TOO_LONG", message: `URL must be ${MAX_URL_LENGTH} characters or fewer.` }, { status: 400 });

  const requestId = randomUUID();
  const resolution = await resolveGoal(goal, url, limit);
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin).replace(/\/$/, "");

  const owned = resolution.owned.map((match) => ({
    ...match,
    execute: match.status === "live" && match.endpoint ? `${baseUrl}${match.endpoint}` : null,
    spendingAuthorizationRequired: match.priceUsd > 0
  }));

  const topLiveOwned = owned.find((match) => match.status === "live");
  const candidateCount = resolution.mcp.length + resolution.marketplace.length;
  const singleProbeableMcp = resolution.mcp.length === 1 && Boolean(resolution.mcp[0]?.endpoint)
    ? resolution.mcp[0]
    : null;
  const ambiguousDiscovery = candidateCount > 1;

  const topDirectOwned = owned.find(
    (match) => match.rank === 1 && match.status === "live" && match.priceUsd > 0 && match.endpoint
  );
  const directOwnedId = topDirectOwned?.id && topDirectOwned.id in {
    "http-inspect": true,
    "tool-contract": true,
    "mcp-probe": true,
    "agent-readiness": true,
    "openapi-select": true,
    "verified-resolve": true,
    "batch-verified-resolve": true
  }
    ? topDirectOwned.id as PaidCapabilityId
    : null;

  const directInput = directOwnedId === "http-inspect" && url
    ? { url }
    : directOwnedId === "agent-readiness" && url
      ? { url }
      : directOwnedId === "mcp-probe" && singleProbeableMcp?.endpoint
        ? { endpoint: singleProbeableMcp.endpoint }
        : directOwnedId === "openapi-select" && url
          ? { specUrl: url, goal }
          : directOwnedId === "verified-resolve"
          ? { goal, ...(url ? { url } : {}) }
          : undefined;

  const recommendedPaidAction: PaidRecommendation | null = directOwnedId
    ? paidRecommendation(
        baseUrl,
        directOwnedId,
        "The highest-ranked live AgentResolver capability directly matches this goal. Use this owned endpoint before paying for a broader discovery or verification step.",
        directInput
      )
    : singleProbeableMcp
      ? paidRecommendation(
          baseUrl,
          "mcp-probe",
          "Free discovery found one concrete MCP endpoint. Live-preflight it before depending on it.",
          { endpoint: singleProbeableMcp.endpoint as string }
        )
      : resolution.mcp.length > 0 || ambiguousDiscovery
        ? paidRecommendation(
            baseUrl,
            "verified-resolve",
            resolution.mcp.length > 0
              ? `Discovery found ${resolution.mcp.length} MCP candidates. Verified Resolve live-probes up to two top candidates and returns comparative evidence.`
              : `Discovery found ${candidateCount} external candidates. Verified Resolve adds bounded live verification before selection.`,
            { goal, ...(url ? { url } : {}) }
          )
        : null;

  console.log(JSON.stringify({
    event: "resolver_call", requestId, at: new Date().toISOString(), callerHash: callerHash(req),
    userAgent: safeUserAgent(req), referrerHost: referrerHost(req),
    goalHash: shortHash(goal), goalLength: goal.length, intentTags: classifyIntent(goal), hasUrl: Boolean(url),
    topOwnedCapability: resolution.owned[0]?.id || null, mcpMatchCount: resolution.mcp.length,
    marketplaceMatchCount: resolution.marketplace.length,
    paidRecommendationShown: Boolean(recommendedPaidAction),
    paidRecommendationCapability: recommendedPaidAction?.capabilityId || null,
    paidRecommendationPriceUsd: recommendedPaidAction?.priceUsd || null
  }));

  if (recommendedPaidAction) {
    console.log(JSON.stringify({
      event: "paid_recommendation_shown",
      requestId,
      at: new Date().toISOString(),
      callerHash: callerHash(req),
      capabilityId: recommendedPaidAction.capabilityId,
      priceUsd: recommendedPaidAction.priceUsd,
      reason: directOwnedId
        ? "direct_owned_match"
        : singleProbeableMcp
          ? "single_mcp_probe"
          : resolution.mcp.length > 0
            ? "mcp_live_verification"
            : "multiple_external_candidates"
    }));
  }

  return NextResponse.json({
    requestId,
    resolver: "AgentResolver",
    goal,
    url: url || null,
    paid: true,
    priceUsd: getPaidCapability("resolve").priceUsd,
    discovery: {
      canonical: baseUrl,
      resolve: `${baseUrl}/api/resolve`,
      mcp: `${baseUrl}/mcp`,
      mcpServerCard: `${baseUrl}/mcp/server-card`,
      openapi: `${baseUrl}/openapi.json`,
      capabilities: `${baseUrl}/capabilities.json`,
      paidManifest: `${baseUrl}/.well-known/x402`,
      agentDocs: `${baseUrl}/llms.txt`,
      hint: "Static capability metadata is free. Goal-specific capability resolution costs $0.001 USDC on Base and never authorizes any subsequent spending."
    },
    owned,
    mcp: resolution.mcp,
    marketplace: resolution.marketplace,
    recommendedPaidAction,
    next: recommendedPaidAction
      ? `Paid resolution found a concrete next verification step. Optional verification is available for ${formatUsd(recommendedPaidAction.priceUsd)} USDC on Base. The 402 challenge is a quote only; call it only under the calling agent's independent spending policy.`
      : resolution.marketplace.length > 0
        ? "Review marketplace payment requirements and input schema before calling a provider. Only pay under the calling agent's own authorization and budget policy."
        : resolution.mcp.length > 0
          ? "Review the MCP server metadata and connect only if it fits the calling agent's trust and authorization policy."
          : topLiveOwned?.priceUsd && topLiveOwned.priceUsd > 0
            ? `A live AgentResolver capability is available at $${formatUsd(topLiveOwned.priceUsd)} per call. Call its execute URL only if the calling agent is authorized to spend.`
            : topLiveOwned
              ? "Use the highest-ranked live AgentResolver capability if it fits."
              : "No suitable live marketplace, MCP server, or owned capability was found."
  }, { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
}

type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;
let paidHandler: PaidHandler | null = null;

function getPaidHandler(): PaidHandler {
  if (paidHandler) return paidHandler;
  const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
  const facilitatorUrl = (process.env.X402_FACILITATOR_URL || X402_FACILITATOR_URL).trim();
  const client = new HTTPFacilitatorClient({ url: facilitatorUrl, timeoutMs: 10_000 });
  const server = new x402ResourceServer(client)
    .register(X402_NETWORK, new ExactEvmScheme());

  paidHandler = withX402<unknown>(resolveHandler, {
    "/api/resolve": {
      accepts: {
        scheme: "exact",
        price: X402_PRICING.resolve,
        network: X402_NETWORK,
        payTo: payTo as `0x${string}`
      },
      description: "Resolve one natural-language capability need into ranked AgentResolver-owned, MCP, and marketplace candidates.",
      mimeType: "application/json"
    }
  }, server) as PaidHandler;
  return paidHandler;
}

async function paidRequest(req: NextRequest) {
  logPaidCapabilityAttempt(req, "resolve");
  try {
    const response = await getPaidHandler()(req);
    logX402Settlement(response, "resolve");
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "paid_capability_configuration_error",
      capabilityId: "resolve",
      at: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Unknown error"
    }));
    return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) { return paidRequest(req); }
export async function GET() { return x402DiscoveryChallenge("resolve"); }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, payment-signature, payment-required, payment-response"
  }});
}
