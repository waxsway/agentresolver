import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { verifiedResolve } from "@/lib/verifiedResolve";
import { logX402Settlement } from "@/lib/telemetry";
import { ATTRIBUTION_HEADER, attributionIdFromRequest, logAttributedSettlement } from "@/lib/transactionAttribution";
import { logLegacyPaidAttempt, logLegacyPaidDiscovery } from "@/lib/legacyPaidTraffic";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { bazaarResourceServerExtension, paidRouteBazaarExtension } from "@/lib/bazaarDiscovery";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_PRICING, X402_SOLANA_NETWORK, X402_SOLANA_PAY_TO } from "@/lib/x402Config";

export const dynamic = "force-dynamic";
const MAX_GOAL = 600;
const MAX_URL = 500;
type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;
let paidHandler: PaidHandler | null = null;

async function verifiedResolveHandler(req: NextRequest): Promise<NextResponse<unknown>> {
  const body = (await req.json().catch(() => null)) as { goal?: unknown; url?: unknown } | null;
  const goal = String(body?.goal || "").trim();
  const url = body?.url ? String(body.url).trim() : undefined;
  if (!goal) return NextResponse.json({ error: "MISSING_GOAL", message: "Provide the capability you need verified." }, { status: 400 });
  if (goal.length > MAX_GOAL || (url && url.length > MAX_URL)) return NextResponse.json({ error: "INPUT_TOO_LONG", message: "Goal or target URL is too long." }, { status: 400 });
  const report = await verifiedResolve(goal, url);
  console.log(JSON.stringify({ event: "paid_capability_completed", capabilityId: "verified-resolve", at: new Date().toISOString(), verifiedMcpCount: report.liveVerification.filter((item) => item.mcpCompatible).length, verifiedMarketplaceCount: report.liveMarketplaceVerification.filter((item) => item.x402Compatible).length, candidateCount: report.owned.length + report.mcp.length + report.marketplace.length }));
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
      ], description: "Resolve a missing capability and perform up to two unpaid live verification probes across top MCP and x402/HTTP marketplace candidates before returning a recommendation.", mimeType: "application/json",
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
