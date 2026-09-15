import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { batchVerifiedResolve } from "@/lib/batchVerifiedResolve";
import { logPaidCapabilityAttempt } from "@/lib/telemetry";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_PRICING } from "@/lib/x402Config";

export const dynamic = "force-dynamic";
const MAX_GOALS = 4;
const MAX_GOAL_LENGTH = 600;
const MAX_URL_LENGTH = 500;
type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;
let paidHandler: PaidHandler | null = null;

async function batchHandler(req: NextRequest): Promise<NextResponse<unknown>> {
  const body = (await req.json().catch(() => null)) as { items?: unknown } | null;
  if (!Array.isArray(body?.items) || body.items.length === 0) return NextResponse.json({ error: "MISSING_ITEMS", message: "Provide 1 to 4 capability requests in items[]." }, { status: 400 });
  if (body.items.length > MAX_GOALS) return NextResponse.json({ error: "TOO_MANY_ITEMS", message: "A batch supports at most 4 capability requests." }, { status: 400 });
  const items = body.items.map((raw) => { const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}; return { goal: String(item.goal || "").trim(), url: item.url ? String(item.url).trim() : undefined }; });
  if (items.some((item) => !item.goal)) return NextResponse.json({ error: "MISSING_GOAL", message: "Every item must include a non-empty goal." }, { status: 400 });
  if (items.some((item) => item.goal.length > MAX_GOAL_LENGTH || (item.url && item.url.length > MAX_URL_LENGTH))) return NextResponse.json({ error: "INPUT_TOO_LONG", message: "A goal or target URL exceeds the allowed length." }, { status: 400 });
  const report = await batchVerifiedResolve(items);
  console.log(JSON.stringify({ event: "paid_capability_completed", capabilityId: "batch-verified-resolve", at: new Date().toISOString(), itemCount: report.count, maxProbeBudget: report.limits.maxLiveMcpProbesTotal }));
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
  paidHandler = withX402<unknown>(batchHandler, { "/api/batch-verified-resolve": { accepts: { scheme: "exact", price: X402_PRICING.batchVerifiedResolve, network: X402_NETWORK, payTo: payTo as `0x${string}` }, description: "Resolve and live-verify up to four capability requests in one paid batch, probing up to two MCP candidates per request.", mimeType: "application/json" } }, resourceServer) as PaidHandler;
  return paidHandler;
}

async function paidRequest(req: NextRequest) {
  if (process.env.BATCH_VERIFIED_RESOLVE_ENABLED === "false") return NextResponse.json({ error: "CAPABILITY_NOT_LIVE", capabilityId: "batch-verified-resolve", message: "Batch Verified Resolve is temporarily disabled." }, { status: 503 });
  try { logPaidCapabilityAttempt(req, "batch-verified-resolve"); return await getPaidHandler()(req); }
  catch (error) {
    console.error(JSON.stringify({ event: "paid_capability_configuration_error", capabilityId: "batch-verified-resolve", at: new Date().toISOString(), message: error instanceof Error ? error.message : "Unknown error" }));
    return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED", message: "Paid execution is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) { return paidRequest(req); }
export async function GET() { return x402DiscoveryChallenge("batch-verified-resolve"); }
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, payment-signature, payment-required, payment-response" } });
}
