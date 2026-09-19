import { NextResponse } from "next/server";
import {
  parseProviderConversionVerifyInput,
  verifyProviderConversion
} from "@/lib/providerConversionVerification";
import { callerHash, safeUserAgent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const input = parseProviderConversionVerifyInput(
      await req.json().catch(() => null)
    );
    const report = await verifyProviderConversion(input);

    console.log(JSON.stringify({
      event: "provider_conversion_verification",
      at: new Date().toISOString(),
      callerHash: callerHash(req),
      userAgent: safeUserAgent(req),
      attributionId: input.attributionId,
      routeId: input.routeId,
      providerId: input.providerId,
      buyerSettlementVerified: report.buyerSettlementVerified,
      eligibleForFeeSettlement: report.eligibleForFeeSettlement
    }));

    return NextResponse.json(report, {
      status: report.eligibleForFeeSettlement ? 200 : 422,
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_PROVIDER_CONVERSION_PROOF",
        message: error instanceof Error ? error.message : "Conversion verification failed."
      },
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
          "access-control-allow-origin": "*"
        }
      }
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}
