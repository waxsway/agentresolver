import { NextResponse } from "next/server";
import {
  parseProviderSuccessFeeVerifyInput,
  verifyProviderSuccessFee
} from "@/lib/providerSuccessFee";
import { callerHash, safeUserAgent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const input = parseProviderSuccessFeeVerifyInput(
      await req.json().catch(() => null)
    );
    const report = await verifyProviderSuccessFee(input);

    console.log(JSON.stringify({
      event: "provider_success_fee_verification",
      at: new Date().toISOString(),
      callerHash: callerHash(req),
      userAgent: safeUserAgent(req),
      attributionId: input.attributionId,
      providerId: input.providerId,
      routeId: input.routeId,
      buyerSettlementVerified: report.buyerSettlementVerified,
      feeSettlementVerified: report.feeSettlementVerified,
      feeAmountAtomic: report.payment.amountAtomic
    }));

    return NextResponse.json(report, {
      status: report.settled ? 200 : 422,
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_PROVIDER_SUCCESS_FEE_PROOF",
        message:
          error instanceof Error ? error.message : "Success-fee verification failed."
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
