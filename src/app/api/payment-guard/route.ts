import { NextRequest, NextResponse } from "next/server";
import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { executeX402PaymentPreflight } from "@/lib/executeX402PaymentPreflight";

export const dynamic = "force-dynamic";

const route = createDeterministicPaidRoute(
  "x402-payment-preflight",
  executeX402PaymentPreflight,
  { paidGet: true, endpoint: "/api/payment-guard" }
);

export const POST = route.POST;
export async function GET(req: NextRequest) {
  if (!req.nextUrl.searchParams.get("url")?.trim()) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "url is required before payment." },
      { status: 400, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } }
    );
  }
  return route.GET(req);
}
export const OPTIONS = route.OPTIONS;
