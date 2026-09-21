import { NextRequest, NextResponse } from "next/server";
import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { executeX402PaymentPreflight } from "@/lib/executeX402PaymentPreflight";

export const dynamic = "force-dynamic";

/**
 * Base-only Coinbase CDP Guard used to make the useful verify-before-pay
 * product Bazaar-discoverable without moving the canonical Guard off PayAI.
 * CDP's hosted Base rail is kept at $0.002, above its observed settlement floor.
 */
const route = createDeterministicPaidRoute(
  "x402-payment-preflight",
  executeX402PaymentPreflight,
  {
    paidGet: true,
    endpoint: "/api/cdp-payment-guard",
    priceOverride: "$0.002",
    basePaymentRail: "coinbase-cdp"
  }
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
        endpoint: "https://agentresolver.vercel.app/api/cdp-payment-guard",
        queryTemplate: "url={percent-encoded-target-url}&method=GET&maxPriceUsd={optional-max-price}",
        buyerSetup: "https://agentresolver.vercel.app/api/x402-client-setup"
      }
    },
    {
      status: 400,
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
        "x-agentresolver-buyer-setup": "https://agentresolver.vercel.app/api/x402-client-setup",
        "x-agentresolver-payment-guard": "https://agentresolver.vercel.app/api/cdp-payment-guard"
      }
    }
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
