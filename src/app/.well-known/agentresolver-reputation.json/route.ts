import { NextResponse } from "next/server";

const DURABLE_REPUTATION_URL =
  "https://raw.githubusercontent.com/waxsway/agentresolver/settlement-history/history/agentresolver-reputation.json";

export const dynamic = "force-static";

export function GET() {
  return new NextResponse(null, {
    status: 307,
    headers: {
      location: DURABLE_REPUTATION_URL,
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      "access-control-allow-origin": "*"
    }
  });
}
