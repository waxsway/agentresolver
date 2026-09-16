import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { evaluateToolContract } from "@/lib/toolContract";
import { logX402Settlement } from "@/lib/telemetry";
import { logLegacyPaidAttempt, logLegacyPaidDiscovery } from "@/lib/legacyPaidTraffic";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { bazaarResourceServerExtension, paidRouteBazaarExtension } from "@/lib/bazaarDiscovery";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_PRICING, X402_SOLANA_NETWORK, X402_SOLANA_PAY_TO } from "@/lib/x402Config";

export const dynamic = "force-dynamic";
type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;
let paidHandler: PaidHandler | null = null;

async function contractHandler(req: NextRequest): Promise<NextResponse<unknown>> {
  const body = (await req.json().catch(() => null)) as { producerOutputSchema?: unknown; consumerInputSchema?: unknown } | null;
  const producer = body?.producerOutputSchema;
  const consumer = body?.consumerInputSchema;
  if (!producer || typeof producer !== "object" || Array.isArray(producer) || !consumer || typeof consumer !== "object" || Array.isArray(consumer)) {
    return NextResponse.json({ error: "INVALID_SCHEMA", message: "Provide producerOutputSchema and consumerInputSchema as JSON Schema objects." }, { status: 400 });
  }
  const report = evaluateToolContract(producer as Record<string, unknown>, consumer as Record<string, unknown>);
  console.log(JSON.stringify({ event: "paid_capability_completed", capabilityId: "tool-contract", at: new Date().toISOString(), verdict: report.verdict, missingRequired: report.missingRequired.length, typeConflicts: report.typeConflicts.length }));
  return NextResponse.json(report, { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
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
  paidHandler = withX402<unknown>(contractHandler, { "/api/tool-contract": { accepts: [
        { scheme: "exact", price: X402_PRICING.toolContract, network: X402_NETWORK, payTo: payTo as `0x${string}` },
        { scheme: "exact", price: X402_PRICING.toolContract, network: X402_SOLANA_NETWORK, payTo: solanaPayTo }
      ], description: "Check whether one tool's structured output can satisfy another tool's required JSON-schema input contract, returning deterministic incompatibility reasons and normalized safe mappings.", mimeType: "application/json",
      extensions: paidRouteBazaarExtension("tool-contract") } }, resourceServer) as PaidHandler;
  return paidHandler;
}

async function paidRequest(req: NextRequest) {
  logLegacyPaidAttempt(req, "tool-contract", "/api/tool-contract");
  try { const response = await getPaidHandler()(req); logX402Settlement(response, "tool-contract"); return response; }
  catch (error) {
    console.error(JSON.stringify({ event: "paid_capability_configuration_error", capabilityId: "tool-contract", at: new Date().toISOString(), message: error instanceof Error ? error.message : "Unknown error" }));
    return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED", message: "Paid execution is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) { return paidRequest(req); }
export async function GET(req: NextRequest) {
  logLegacyPaidDiscovery(req, "tool-contract", "/api/tool-contract");
  return x402DiscoveryChallenge("tool-contract");
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, payment-signature, payment-required, payment-response" } });
}
