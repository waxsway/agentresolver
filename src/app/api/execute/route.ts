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
        message:
          "This capability is listed for demand measurement but is not enabled for paid execution yet."
      },
      { status: 503 }
    );
  }

  if (capability.priceUsd <= 0) {
    return NextResponse.json({
      capabilityId,
      result:
        "Free capabilities should be called through their direct endpoint.",
      endpoint: capability.endpoint || null
    });
  }

  return NextResponse.json(
    {
      error: "PAID_EXECUTION_NOT_ENABLED",
      capabilityId,
      message:
        "Generic paid execution is intentionally disabled. Paid capabilities must use their own officially verified x402 route."
    },
    { status: 503 }
  );
}
