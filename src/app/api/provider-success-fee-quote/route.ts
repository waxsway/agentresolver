import { NextResponse } from "next/server";
import {
  parseProviderConversionVerifyInput
} from "@/lib/providerConversionVerification";
import { quoteVerifiedProviderSuccessFee } from "@/lib/providerSuccessFee";
import { callerHash, safeUserAgent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const input = parseProviderConversionVerifyInput(
      await req.json().catch(() => null)
    );
    const quote = await quoteVerifiedProviderSuccessFee(input);

    console.log(JSON.stringify({
      event: "provider_success_fee_quote",
      at: new Date().toISOString(),
      callerHash: callerHash(req),
      userAgent: safeUserAgent(req),
      attributionId: input.attributionId,
      providerId: input.providerId,
      routeId: input.routeId,
      providerEnrollment: quote.providerEnrollment,
      grossAmountAtomic: quote.commercial.quote.grossAmountAtomic,
      feeAmountAtomic: quote.payment.amountAtomic
    }));

    return NextResponse.json(quote, {
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "PROVIDER_SUCCESS_FEE_NOT_QUOTABLE",
        message:
          error instanceof Error ? error.message : "Success-fee quote failed."
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
