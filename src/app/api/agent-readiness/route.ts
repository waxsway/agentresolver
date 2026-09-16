import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { auditAgentReadiness } from "@/lib/agentReadiness";
import { logX402Settlement } from "@/lib/telemetry";
import { logLegacyPaidAttempt, logLegacyPaidDiscovery } from "@/lib/legacyPaidTraffic";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { bazaarResourceServerExtension, paidRouteBazaarExtension } from "@/lib/bazaarDiscovery";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_PRICING, X402_SOLANA_NETWORK, X402_SOLANA_PAY_TO } from "@/lib/x402Config";

export const dynamic = "force-dynamic";
const MAX_INPUT = 500;
type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;
let paidHandler: PaidHandler | null = null;

async function auditHandler(req: NextRequest): Promise<NextResponse<unknown>> {
  const body = (await req.json().catch(() => null)) as { target?: unknown; url?: unknown } | null;
  const target = String(body?.target || body?.url || "").trim();
  if (!target) return NextResponse.json({ error: "MISSING_TARGET", message: "Provide a public domain or URL." }, { status: 400 });
  if (target.length > MAX_INPUT) return NextResponse.json({ error: "TARGET_TOO_LONG", message: "Target must be 500 characters or fewer." }, { status: 400 });
  try {
    const report = await auditAgentReadiness(target);
    console.log(JSON.stringify({ event: "paid_capability_completed", capabilityId: "agent-readiness", at: new Date().toISOString(), score: report.score, grade: report.grade, issueCount: report.issues.length }));
    return NextResponse.json(report, { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
  } catch (error) {
    return NextResponse.json({ error: "INVALID_TARGET", message: error instanceof Error ? error.message : "Invalid target." }, { status: 400 });
  }
}

function getPaidHandler(): PaidHandler {
  if (paidHandler) return paidHandler;
  const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
  const solanaPayTo = (process.env.AGENTRESOLVER_SOLANA_PAY_TO || X402_SOLANA_PAY_TO).trim();
  const facilitatorUrl = (process.env.X402_FACILITATOR_URL || X402_FACILITATOR_URL).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) throw new Error("AGENTRESOLVER_PAY_TO is invalid.");
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solanaPayTo)) throw new Error("AGENTRESOLVER_SOLANA_PAY_TO is invalid.");
  if (!/^https:\/\//i.test(facilitatorUrl)) throw new Error("X402_FACILITATOR_URL is invalid.");
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl, timeoutMs: 10_000 });
  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(X402_NETWORK, new ExactEvmScheme())
    .register(X402_SOLANA_NETWORK, new ExactSvmScheme())
    .registerExtension(bazaarResourceServerExtension);
  paidHandler = withX402<unknown>(auditHandler, { "/api/agent-readiness": { accepts: [
        { scheme: "exact", price: X402_PRICING.agentReadiness, network: X402_NETWORK, payTo: payTo as `0x${string}` },
        { scheme: "exact", price: X402_PRICING.agentReadiness, network: X402_SOLANA_NETWORK, payTo: solanaPayTo }
      ], description: "Audit a public website for AI-agent discoverability and machine-readable integration signals.", mimeType: "application/json",
      extensions: paidRouteBazaarExtension("agent-readiness") } }, resourceServer) as PaidHandler;
  return paidHandler;
}

async function paidRequest(req: NextRequest) {
  logLegacyPaidAttempt(req, "agent-readiness", "/api/agent-readiness");
  if (process.env.AGENT_READINESS_ENABLED === "false") return NextResponse.json({ error: "CAPABILITY_NOT_LIVE", capabilityId: "agent-readiness", message: "Agent Readiness Audit is temporarily disabled." }, { status: 503 });
  try { const response = await getPaidHandler()(req); logX402Settlement(response, "agent-readiness"); return response; }
  catch (error) {
    console.error(JSON.stringify({ event: "paid_capability_configuration_error", capabilityId: "agent-readiness", at: new Date().toISOString(), message: error instanceof Error ? error.message : "Unknown error" }));
    return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED", message: "Paid execution is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) { return paidRequest(req); }
export async function GET(req: NextRequest) {
  logLegacyPaidDiscovery(req, "agent-readiness", "/api/agent-readiness");
  return x402DiscoveryChallenge("agent-readiness");
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, payment-signature, payment-required, payment-response" } });
}
