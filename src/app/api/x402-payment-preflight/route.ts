import { NextRequest, NextResponse } from "next/server";
import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { executeX402PaymentPreflight } from "@/lib/executeX402PaymentPreflight";

export const dynamic = "force-dynamic";

const route = createDeterministicPaidRoute(
  "x402-payment-preflight",
  executeX402PaymentPreflight,
  { paidGet: true }
);

function invalidInput() {
  return NextResponse.json(
    {
      error: "INVALID_INPUT",
      message: "url is required before payment.",
      paymentRequired: false,
      spendingAuthorized: false,
      requiredInput: {
        url: "https://target.example/api",
        method: "GET"
      },
      retry: {
        method: "GET",
        endpoint: "https://agentresolver.vercel.app/api/x402-payment-preflight",
        queryTemplate: "url={percent-encoded-target-url}&method=GET&maxPriceUsd={optional-max-price}",
        buyerSetup: "https://agentresolver.vercel.app/api/x402-client-setup"
      }
    },
    { status: 400, headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "x-agentresolver-buyer-setup, x-agentresolver-payment-guard, link",
      "x-agentresolver-buyer-setup": "https://agentresolver.vercel.app/api/x402-client-setup",
      "x-agentresolver-payment-guard": "https://agentresolver.vercel.app/api/payment-guard"
    } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.clone().json().catch(() => null) as { url?: unknown } | null;
  if (typeof body?.url !== "string" || !body.url.trim()) return invalidInput();
  return route.POST(req);
}

export async function GET(req: NextRequest) {
  if (!req.nextUrl.searchParams.get("url")?.trim()) return invalidInput();
  return route.GET(req);
}
export const OPTIONS = route.OPTIONS;
