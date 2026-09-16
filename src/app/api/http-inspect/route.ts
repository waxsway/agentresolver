import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { inspectHttpResource } from "@/lib/httpInspect";
import { logX402Settlement } from "@/lib/telemetry";
import { logLegacyPaidAttempt, logLegacyPaidDiscovery } from "@/lib/legacyPaidTraffic";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_PRICING, X402_SOLANA_NETWORK, X402_SOLANA_PAY_TO } from "@/lib/x402Config";

export const dynamic = "force-dynamic";
type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;
let paidHandler: PaidHandler | null = null;

async function inspectHandler(req: NextRequest): Promise<NextResponse<unknown>> {
  const body = (await req.json().catch(() => null)) as {
    url?: unknown;
    maxPriceUsd?: unknown;
    expectedPayTo?: unknown;
    expectedNetwork?: unknown;
    method?: unknown;
    body?: unknown;
    allowUnpaidPostProbe?: unknown;
  } | null;
  const raw = String(body?.url || "").trim();
  const maxPriceUsd = typeof body?.maxPriceUsd === "number" ? body.maxPriceUsd : undefined;
  const expectedPayTo = typeof body?.expectedPayTo === "string" ? body.expectedPayTo.trim() : undefined;
  const expectedNetwork = typeof body?.expectedNetwork === "string" ? body.expectedNetwork.trim() : undefined;
  const methodRaw = typeof body?.method === "string" ? body.method.toUpperCase() : "GET";
  const method = methodRaw === "GET" || methodRaw === "HEAD" || methodRaw === "POST" ? methodRaw : undefined;
  const allowUnpaidPostProbe = body?.allowUnpaidPostProbe === true;

  try {
    if (!method) throw new Error("method must be GET, HEAD, or POST.");
    const report = await inspectHttpResource(raw, {
      maxPriceUsd,
      expectedPayTo,
      expectedNetwork,
      method,
      body: body?.body,
      allowUnpaidPostProbe
    });
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "http-inspect",
      surface: "http",
      at: new Date().toISOString(),
      status: report.status,
      latencyMs: report.latencyMs,
      x402Detected: report.x402.detected,
      x402Score: report.x402.score,
      trustScore: report.trust.score
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
  const solanaPayTo = (process.env.AGENTRESOLVER_SOLANA_PAY_TO || X402_SOLANA_PAY_TO).trim();
  const facilitatorUrl = (process.env.AGENTRESOLVER_X402_FACILITATOR_URL || X402_FACILITATOR_URL).trim();
  const client = new HTTPFacilitatorClient({ url: facilitatorUrl, timeoutMs: 10_000 });
  const server = new x402ResourceServer(client)
    .register(X402_NETWORK, new ExactEvmScheme())
    .register(X402_SOLANA_NETWORK, new ExactSvmScheme())
    .registerExtension(bazaarResourceServerExtension);
  paidHandler = withX402<unknown>(inspectHandler, {
    "/api/http-inspect": {
      accepts: [
        {
          scheme: "exact",
          price: X402_PRICING.httpInspect,
          network: X402_NETWORK,
          payTo: payTo as `0x${string}`
        },
        {
          scheme: "exact",
          price: X402_PRICING.httpInspect,
          network: X402_SOLANA_NETWORK,
          payTo: solanaPayTo
        }
      ],
      description: "x402 payment preflight before paying an unfamiliar endpoint. Verify payTo recipient, endpoint safety, quoted USDC price, Base/Solana network, asset, resource binding and PAYMENT-REQUIRED challenge structure plus TLS/reachability before an autonomous agent authorizes spend.",
      mimeType: "application/json",
      extensions: {
        ...declareDiscoveryExtension({
          input: { url: "https://example.com/api", method: "GET", maxPriceUsd: 0.01, expectedNetwork: "eip155:8453" },
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", pattern: "^https://", maxLength: 500 },
              maxPriceUsd: { type: "number", minimum: 0, maximum: 1000 },
              expectedPayTo: { type: "string", minLength: 1, maxLength: 128 },
              expectedNetwork: { type: "string", maxLength: 128 },
              method: { type: "string", enum: ["GET", "HEAD", "POST"] },
              body: {},
              allowUnpaidPostProbe: { type: "boolean" }
            },
            required: ["url"],
            additionalProperties: false
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
              },
              x402: {
                detected: true,
                challengeHeaderPresent: true,
                parseable: true,
                version: 2,
                acceptCount: 1,
                scheme: "exact",
                network: "eip155:8453",
                asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                payTo: "0x1111111111111111111111111111111111111111",
                resource: "https://example.com/api",
                amountAtomic: "5000",
                amountUsd: 0.005,
                score: 100,
                verdict: "strong",
                checks: [
                  { id: "resource_binding", label: "Challenge bound to requested resource", passed: true, weight: 10, evidence: "resource=https://example.com/api." }
                ]
              },
              trust: {
                score: 96,
                infrastructureScore: 91,
                x402Score: 100,
                grade: "A",
                verdict: "strong",
                checks: [
                  { id: "tls_authorized", label: "TLS certificate authorized", passed: true, weight: 30, evidence: "Certificate chain authorized." }
                ]
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
