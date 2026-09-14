import { NextResponse } from "next/server";
import { CAPABILITIES } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { capabilityId?: unknown; input?: unknown }
    | null;

  const capabilityId = String(body?.capabilityId || "").trim();
  const capability = CAPABILITIES.find((item) => item.id === capabilityId);

  if (!capability) {
    return NextResponse.json({ error: "UNKNOWN_CAPABILITY" }, { status: 404 });
  }

  if (capability.status !== "live") {
    return NextResponse.json(
      {
        error: "CAPABILITY_NOT_LIVE",
        capabilityId,
        message: "This capability is listed for demand measurement but is not enabled for paid execution yet."
      },
      { status: 503 }
    );
  }

  if (capability.priceUsd <= 0) {
    return NextResponse.json({
      capabilityId,
      result: "Free capabilities should be called through their direct endpoint."
    });
  }

  const payTo = (process.env.AGENTRESOLVER_PAY_TO || "").trim();
  const asset = (process.env.AGENTRESOLVER_USDC_ASSET || "").trim();
  const network = (process.env.AGENTRESOLVER_NETWORK || "eip155:8453").trim();

  if (!payTo || !asset) {
    return NextResponse.json(
      {
        error: "PAYMENTS_NOT_CONFIGURED",
        message: "Paid execution is intentionally disabled until a receiving wallet and payment facilitator are configured."
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      error: "PAYMENT_REQUIRED",
      x402Version: 2,
      resource: {
        url: req.url,
        description: capability.description,
        mimeType: "application/json",
        serviceName: "AgentResolver",
        tags: capability.tags
      },
      accepts: [
        {
          scheme: "exact",
          network,
          amountUsd: capability.priceUsd,
          asset,
          payTo
        }
      ]
    },
    { status: 402 }
  );
}
