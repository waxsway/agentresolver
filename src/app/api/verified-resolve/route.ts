import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { verifiedResolve } from "@/lib/verifiedResolve";
import { logPaidCapabilityAttempt, logX402Settlement } from "@/lib/telemetry";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_PRICING } from "@/lib/x402Config";

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
  console.log(JSON.stringify({ event: "paid_capability_completed", capabilityId: "verified-resolve", at: new Date().toISOString(), verifiedMcpCount: report.liveVerification.filter((item) => item.mcpCompatible).length, candidateCount: report.owned.length + report.mcp.length + report.marketplace.length }));
  return NextResponse.json(report, { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
}

function getPaidHandler(): PaidHandler {
  if (paidHandler) return paidHandler;
  const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
  const facilitatorUrl = (process.env.X402_FACILITATOR_URL || X402_FACILITATOR_URL).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) throw new Error("AGENTRESOLVER_PAY_TO is invalid.");
  if (!/^https:\/\//i.test(facilitatorUrl)) throw new Error("X402_FACILITATOR_URL is invalid.");
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl, timeoutMs: 10_000 });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(X402_NETWORK, new ExactEvmScheme());
  paidHandler = withX402<unknown>(verifiedResolveHandler, { "/api/verified-resolve": { accepts: { scheme: "exact", price: X402_PRICING.verifiedResolve, network: X402_NETWORK, payTo: payTo as `0x${string}` }, description: "Resolve a missing capability and live-verify up to two top MCP candidates before returning a recommendation.", mimeType: "application/json" } }, resourceServer) as PaidHandler;
  return paidHandler;
}

async function paidRequest(req: NextRequest) {
  logPaidCapabilityAttempt(req, "verified-resolve");
  if (process.env.VERIFIED_RESOLVE_ENABLED === "false") return NextResponse.json({ error: "CAPABILITY_NOT_LIVE", capabilityId: "verified-resolve", message: "Verified Resolve is temporarily disabled." }, { status: 503 });
  try { const response = await getPaidHandler()(req); logX402Settlement(response, "verified-resolve"); return response; }
  catch (error) {
    console.error(JSON.stringify({ event: "paid_capability_configuration_error", capabilityId: "verified-resolve", at: new Date().toISOString(), message: error instanceof Error ? error.message : "Unknown error" }));
    return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED", message: "Paid execution is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) { return paidRequest(req); }
export async function GET() { return x402DiscoveryChallenge("verified-resolve"); }
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, payment-signature, payment-required, payment-response" } });
}
