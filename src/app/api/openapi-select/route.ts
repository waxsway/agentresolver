import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { selectOpenApiOperation } from "@/lib/openapiSelect";
import { logPaidCapabilityAttempt, logX402Settlement } from "@/lib/telemetry";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_PRICING } from "@/lib/x402Config";

export const dynamic = "force-dynamic";
const MAX_URL = 500;
const MAX_GOAL = 600;
type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;
let paidHandler: PaidHandler | null = null;

async function selectHandler(req: NextRequest): Promise<NextResponse<unknown>> {
  const body = (await req.json().catch(() => null)) as { specUrl?: unknown; goal?: unknown } | null;
  const specUrl = String(body?.specUrl || "").trim();
  const goal = String(body?.goal || "").trim();

  if (!specUrl || !goal) {
    return NextResponse.json({ error: "MISSING_INPUT", message: "Provide specUrl and goal." }, { status: 400 });
  }
  if (specUrl.length > MAX_URL || goal.length > MAX_GOAL) {
    return NextResponse.json({ error: "INPUT_TOO_LONG", message: "specUrl or goal exceeds the allowed length." }, { status: 400 });
  }

  try {
    const report = await selectOpenApiOperation(specUrl, goal);
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "openapi-select",
      at: new Date().toISOString(),
      operationCount: report.api.operationCount,
      selectedOperationId: report.selected?.operationId || null,
      selectedMethod: report.selected?.method || null,
      confidence: report.confidence,
      score: report.selected?.score || 0
    }));
    return NextResponse.json(report, { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
  } catch (error) {
    return NextResponse.json({
      error: "OPENAPI_SELECTION_FAILED",
      message: error instanceof Error ? error.message : "OpenAPI selection failed."
    }, { status: 400 });
  }
}

function getPaidHandler(): PaidHandler {
  if (paidHandler) return paidHandler;
  const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
  const facilitatorUrl = (process.env.X402_FACILITATOR_URL || X402_FACILITATOR_URL).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) throw new Error("AGENTRESOLVER_PAY_TO is invalid.");
  if (!/^https:\/\//i.test(facilitatorUrl)) throw new Error("X402_FACILITATOR_URL is invalid.");

  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl, timeoutMs: 10_000 });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(X402_NETWORK, new ExactEvmScheme());
  paidHandler = withX402<unknown>(selectHandler, {
    "/api/openapi-select": {
      accepts: {
        scheme: "exact",
        price: X402_PRICING.openapiSelect,
        network: X402_NETWORK,
        payTo: payTo as `0x${string}`
      },
      description: "Select the best operation from a public JSON OpenAPI specification for a natural-language goal and return a compact execution-ready request contract.",
      mimeType: "application/json"
    }
  }, resourceServer) as PaidHandler;
  return paidHandler;
}

async function paidRequest(req: NextRequest) {
  logPaidCapabilityAttempt(req, "openapi-select");
  try {
    const response = await getPaidHandler()(req);
    logX402Settlement(response, "openapi-select");
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "paid_capability_configuration_error",
      capabilityId: "openapi-select",
      at: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Unknown error"
    }));
    return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED", message: "Paid execution is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) { return paidRequest(req); }
export async function GET() { return x402DiscoveryChallenge("openapi-select"); }
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, payment-signature, payment-required, payment-response"
    }
  });
}
