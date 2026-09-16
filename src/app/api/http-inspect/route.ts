import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { inspectHttpResource } from "@/lib/httpInspect";
import { logX402Settlement } from "@/lib/telemetry";
import { logLegacyPaidAttempt, logLegacyPaidDiscovery } from "@/lib/legacyPaidTraffic";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_PRICING } from "@/lib/x402Config";

export const dynamic = "force-dynamic";
type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;
let paidHandler: PaidHandler | null = null;

async function inspectHandler(req: NextRequest): Promise<NextResponse<unknown>> {
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const raw = String(body?.url || "").trim();

  try {
    const report = await inspectHttpResource(raw);
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "http-inspect",
      surface: "http",
      at: new Date().toISOString(),
      status: report.status,
      latencyMs: report.latencyMs
    }));
    return NextResponse.json(report, {
      headers: { "cache-control": "no-store", "access-control-allow-origin": "*" }
    });
  } catch (error) {
    return NextResponse.json({
      error: "INSPECTION_FAILED",
      message: error instanceof Error ? error.message : "Inspection failed."
    }, { status: 400 });
  }
}

function getPaidHandler(): PaidHandler {
  if (paidHandler) return paidHandler;
  const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
  const facilitatorUrl = (process.env.X402_FACILITATOR_URL || X402_FACILITATOR_URL).trim();
  const client = new HTTPFacilitatorClient({ url: facilitatorUrl, timeoutMs: 10_000 });
  const server = new x402ResourceServer(client)
    .register(X402_NETWORK, new ExactEvmScheme())
    .registerExtension(bazaarResourceServerExtension);
  paidHandler = withX402<unknown>(inspectHandler, {
    "/api/http-inspect": {
      accepts: {
        scheme: "exact",
        price: X402_PRICING.httpInspect,
        network: X402_NETWORK,
        payTo: payTo as `0x${string}`
      },
      description: "Inspect a public HTTPS resource for current status, latency, response metadata, cache validators, TLS/certificate evidence and baseline security headers.",
      mimeType: "application/json",
      extensions: {
        ...declareDiscoveryExtension({
          input: { url: "https://example.com" },
          inputSchema: {
            type: "object",
            properties: { url: { type: "string", pattern: "^https://", maxLength: 2048 } },
            required: ["url"]
          },
          bodyType: "json",
          output: {
            example: {
              url: "https://example.com/",
              status: 200,
              ok: true,
              latencyMs: 85,
              contentType: "text/html",
              cacheControl: "max-age=3600",
              redirect: { isRedirect: false, location: null },
              dns: { family: 4 },
              tls: {
                protocol: "TLSv1.3",
                authorized: true,
                validFrom: "Jan 1 00:00:00 2026 GMT",
                validTo: "Jan 1 00:00:00 2027 GMT",
                daysRemaining: 108,
                subjectCn: "example.com",
                issuerCn: "Example CA"
              },
              security: {
                hsts: true,
                csp: false,
                xContentTypeOptions: true,
                xFrameOptions: true,
                referrerPolicy: true,
                permissionsPolicy: false
              }
            }
          }
        })
      }
    }
  }, server) as PaidHandler;
  return paidHandler;
}

async function paidRequest(req: NextRequest) {
  logLegacyPaidAttempt(req, "http-inspect", "/api/http-inspect");
  try {
    const response = await getPaidHandler()(req);
    logX402Settlement(response, "http-inspect");
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "paid_capability_configuration_error",
      capabilityId: "http-inspect",
      at: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Unknown error"
    }));
    return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) { return paidRequest(req); }
export async function GET(req: NextRequest) {
  logLegacyPaidDiscovery(req, "http-inspect", "/api/http-inspect");
  return x402DiscoveryChallenge("http-inspect");
}
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
