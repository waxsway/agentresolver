import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ID = /^mon_[0-9a-f]{20}$/;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim() || "";
  if (!ID.test(id)) {
    return NextResponse.json(
      { error: "INVALID_MONITOR_ID", message: "Provide a valid managed monitor id." },
      { status: 400, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } }
    );
  }

  const source =
    "https://raw.githubusercontent.com/waxsway/agentresolver/monitoring-state/monitoring/status/" +
    encodeURIComponent(id) +
    ".json";

  try {
    const upstream = await fetch(source, {
      cache: "no-store",
      headers: { "user-agent": "AgentResolver-Managed-Monitor/0.1" }
    });
    if (upstream.status === 404) {
      return NextResponse.json(
        { error: "MONITOR_NOT_ACTIVE", id },
        { status: 404, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } }
      );
    }
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "MONITOR_STATE_UNAVAILABLE", id },
        { status: 503, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } }
      );
    }
    const body = await upstream.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    });
  } catch {
    return NextResponse.json(
      { error: "MONITOR_STATE_UNAVAILABLE", id },
      { status: 503, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } }
    );
  }
}
