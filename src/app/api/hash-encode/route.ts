import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { runHashEncode, type HashEncodeOperation } from "@/lib/hashEncode";
import { logPaidCapabilityAttempt, logX402Settlement } from "@/lib/telemetry";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { bazaarResourceServerExtension, paidRouteBazaarExtension } from "@/lib/bazaarDiscovery";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_PRICING, X402_SOLANA_NETWORK, X402_SOLANA_PAY_TO } from "@/lib/x402Config";

export const dynamic = "force-dynamic";
type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;
let paidHandler: PaidHandler | null = null;

const OPERATIONS = new Set<HashEncodeOperation>([
  "sha256",
  "sha512",
  "hmac-sha256",
  "base64-encode",
  "base64-decode",
  "jwt-decode"
]);

async function hashEncodeHandler(req: NextRequest): Promise<NextResponse<unknown>> {
  const body = (await req.json().catch(() => null)) as {
    operation?: unknown;
    input?: unknown;
    secret?: unknown;
  } | null;

  const operation = typeof body?.operation === "string" ? body.operation : "";
  const input = typeof body?.input === "string" ? body.input : null;
  const secret = typeof body?.secret === "string" ? body.secret : undefined;

  if (!OPERATIONS.has(operation as HashEncodeOperation) || input === null) {
    return NextResponse.json({
      error: "INVALID_INPUT",
      message: "Provide operation and input. Supported operations: sha256, sha512, hmac-sha256, base64-encode, base64-decode, jwt-decode."
    }, { status: 400 });
  }

  try {
    const result = runHashEncode({
      operation: operation as HashEncodeOperation,
      input,
      ...(secret !== undefined ? { secret } : {})
    });
    console.log(JSON.stringify({
      event: "paid_capability_completed",
      capabilityId: "hash-encode",
      surface: "http",
      at: new Date().toISOString(),
      operation,
      inputBytes: result.inputBytes
    }));
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store", "access-control-allow-origin": "*" }
    });
  } catch (error) {
    return NextResponse.json({
      error: "HASH_ENCODE_FAILED",
      message: error instanceof Error ? error.message : "Hash or encoding operation failed."
    }, { status: 400 });
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

  const client = new HTTPFacilitatorClient({ url: facilitatorUrl, timeoutMs: 10_000 });
  const server = new x402ResourceServer(client)
    .register(X402_NETWORK, new ExactEvmScheme())
    .register(X402_SOLANA_NETWORK, new ExactSvmScheme())
    .registerExtension(bazaarResourceServerExtension);

  paidHandler = withX402<unknown>(hashEncodeHandler, {
    "/api/hash-encode": {
      accepts: [
        {
          scheme: "exact",
          price: X402_PRICING.hashEncode,
          network: X402_NETWORK,
          payTo: payTo as `0x${string}`
        },
        {
          scheme: "exact",
          price: X402_PRICING.hashEncode,
          network: X402_SOLANA_NETWORK,
          payTo: solanaPayTo
        }
      ],
      description: "Deterministic SHA-256, SHA-512, HMAC-SHA256, Base64 encode/decode, and non-verifying JWT decode.",
      mimeType: "application/json",
      extensions: paidRouteBazaarExtension("hash-encode")
    }
  }, server) as PaidHandler;

  return paidHandler;
}

async function paidRequest(req: NextRequest) {
  logPaidCapabilityAttempt(req, "hash-encode");
  try {
    const response = await getPaidHandler()(req);
    logX402Settlement(response, "hash-encode");
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "paid_capability_configuration_error",
      capabilityId: "hash-encode",
      at: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Unknown error"
    }));
    return NextResponse.json({
      error: "PAYMENTS_NOT_CONFIGURED",
      message: "Paid execution is temporarily unavailable."
    }, { status: 503 });
  }
}

export async function POST(req: NextRequest) { return paidRequest(req); }
export async function GET() { return x402DiscoveryChallenge("hash-encode"); }
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
