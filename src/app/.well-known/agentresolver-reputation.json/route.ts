import { NextResponse } from "next/server";

const VERIFIED_SETTLEMENT_HISTORY_URL =
  "https://raw.githubusercontent.com/waxsway/agentresolver/evidence-history/evidence/settlements.json";

export const dynamic = "force-static";

export function GET() {
  return new NextResponse(null, {
    status: 307,
    headers: {
      location: VERIFIED_SETTLEMENT_HISTORY_URL,
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      "access-control-allow-origin": "*"
    }
  });
}
