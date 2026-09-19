import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { verifiedResolve } from "@/lib/verifiedResolve";
import type { ProcurementConstraints } from "@/lib/procurement";
import { logX402Settlement } from "@/lib/telemetry";
import { ATTRIBUTION_HEADER, attributionIdFromRequest, logAttributedSettlement } from "@/lib/transactionAttribution";
import { logLegacyPaidAttempt, logLegacyPaidDiscovery } from "@/lib/legacyPaidTraffic";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { bazaarResourceServerExtension, paidRouteBazaarExtension } from "@/lib/bazaarDiscovery";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_PRICING, X402_SOLANA_NETWORK, X402_SOLANA_PAY_TO } from "@/lib/x402Config";

export const dynamic = "force-dynamic";
const MAX_GOAL = 600;
const MAX_URL = 500;
const MAX_SCHEMA_BYTES = 50_000;

function boundedSchema(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try {
    return JSON.stringify(value).length <= MAX_SCHEMA_BYTES
      ? value as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function procurementConstraints(value: unknown): ProcurementConstraints {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { requireHttps: true };
  }
  const raw = value as Record<string, unknown>;
  const maxPriceUsd = Number(raw.maxPriceUsd);
  const protocol =
    raw.protocol === "x402" ||
    raw.protocol === "l402" ||
    raw.protocol === "mpp" ||
    raw.protocol === "mcp" ||
    raw.protocol === "any"
      ? raw.protocol
      : undefined;
  const preferredNetworks = Array.isArray(raw.preferredNetworks)
    ? raw.preferredNetworks
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8)
    : undefined;
  const sideEffect =
    raw.sideEffect === "read-only" ||
    raw.sideEffect === "state-changing" ||
    raw.sideEffect === "any"
      ? raw.sideEffect
      : undefined;
  const auth =
    raw.auth === "none" ||
    raw.auth === "wallet" ||
    raw.auth === "api-key" ||
    raw.auth === "any"
      ? raw.auth
      : undefined;

  return {
    ...(Number.isFinite(maxPriceUsd) && maxPriceUsd >= 0 && maxPriceUsd <= 1000
      ? { maxPriceUsd }
      : {}),
    ...(preferredNetworks ? { preferredNetworks } : {}),
    ...(protocol ? { protocol } : {}),
    requireHttps: raw.requireHttps !== false,
    ...(boundedSchema(raw.availableInputSchema)
      ? { availableInputSchema: boundedSchema(raw.availableInputSchema) }
      : {}),
    ...(boundedSchema(raw.requiredOutputSchema)
      ? { requiredOutputSchema: boundedSchema(raw.requiredOutputSchema) }
      : {}),
    ...(sideEffect ? { sideEffect } : {}),
    ...(auth ? { auth } : {})
  };
}
type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;
let paidHandler: PaidHandler | null = null;

async function verifiedResolveHandler(req: NextRequest): Promise<NextResponse<unknown>> {
  const body = (await req.json().catch(() => null)) as {
    goal?: unknown;
    url?: unknown;
    constraints?: unknown;
  } | null;
  const goal = String(body?.goal || "").trim();
  const url = body?.url ? String(body.url).trim() : undefined;
  const constraints = procurementConstraints(body?.constraints);
  if (!goal) return NextResponse.json({ error: "MISSING_GOAL", message: "Provide the capability you need verified." }, { status: 400 });
  if (goal.length > MAX_GOAL || (url && url.length > MAX_URL)) return NextResponse.json({ error: "INPUT_TOO_LONG", message: "Goal or target URL is too long." }, { status: 400 });
  const report = await verifiedResolve(goal, { url, constraints });
  console.log(JSON.stringify({
    event: "paid_capability_completed",
    capabilityId: "verified-resolve",
    at: new Date().toISOString(),
    procurementCandidateCount: report.procurement.candidateCount,
    selectedSource: report.procurement.selected?.source || null,
    selectedProtocol: report.procurement.selected?.protocol || null,
    selectedStatus: report.procurement.selected?.status || null,
    liveProbeCount: report.liveVerification.length,
    verifiedMcpCount: report.liveMcpVerification.filter((item) => item.mcpCompatible).length,
    verifiedX402Count: report.liveMarketplaceVerification.filter(
      (item) => item.x402Compatible && item.contractMatchesCatalog
    ).length,
    recommendationType: report.recommendation.type
  }));
  return NextResponse.json(report, { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
}

function getPaidHandler(): PaidHandler {
  if (paidHandler) return paidHandler;
  const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
  const solanaPayTo = (process.env.AGENTRESOLVER_SOLANA_PAY_TO || X402_SOLANA_PAY_TO).trim();
  const facilitatorUrl = (process.env.X402_FACILITATOR_URL || X402_FACILITATOR_URL).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) throw new Error("AGENTRESOLVER_PAY_TO is invalid.");
  if (!/^https:\/\//i.test(facilitatorUrl)) throw new Error("X402_FACILITATOR_URL is invalid.");
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl, timeoutMs: 10_000 });
  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(X402_NETWORK, new ExactEvmScheme())
    .register(X402_SOLANA_NETWORK, new ExactSvmScheme())
    .registerExtension(bazaarResourceServerExtension);
  paidHandler = withX402<unknown>(verifiedResolveHandler, { "/api/verified-resolve": { accepts: [
        { scheme: "exact", price: X402_PRICING.verifiedResolve, network: X402_NETWORK, payTo: payTo as `0x${string}` },
        { scheme: "exact", price: X402_PRICING.verifiedResolve, network: X402_SOLANA_NETWORK, payTo: solanaPayTo }
      ], description: "Procure a missing capability across AgentResolver, provider manifests, 402 Index, PayAI, Circle and MCP, then perform at most two unpaid live verification probes for supported MCP/x402 candidates before returning an evidence-backed recommendation. L402/MPP remain discovery-only until protocol-specific verifiers exist.", mimeType: "application/json",
      extensions: paidRouteBazaarExtension("verified-resolve") } }, resourceServer) as PaidHandler;
  return paidHandler;
}

async function paidRequest(req: NextRequest) {
  const attributionId = attributionIdFromRequest(req);
  logLegacyPaidAttempt(req, "verified-resolve", "/api/verified-resolve");
  if (process.env.VERIFIED_RESOLVE_ENABLED === "false") return NextResponse.json({ error: "CAPABILITY_NOT_LIVE", capabilityId: "verified-resolve", message: "Verified Resolve is temporarily disabled." }, { status: 503 });
  try { const response = await getPaidHandler()(req); logX402Settlement(response, "verified-resolve"); logAttributedSettlement(response, "verified-resolve", attributionId); if (attributionId) { response.headers.set(ATTRIBUTION_HEADER, attributionId); response.headers.append("access-control-expose-headers", ATTRIBUTION_HEADER); } return response; }
  catch (error) {
    console.error(JSON.stringify({ event: "paid_capability_configuration_error", capabilityId: "verified-resolve", at: new Date().toISOString(), message: error instanceof Error ? error.message : "Unknown error" }));
    return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED", message: "Paid execution is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) { return paidRequest(req); }
export async function GET(req: NextRequest) {
  logLegacyPaidDiscovery(req, "verified-resolve", "/api/verified-resolve");
  return x402DiscoveryChallenge("verified-resolve");
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, payment-signature, payment-required, payment-response, x-agentresolver-attribution-id" } });
}
