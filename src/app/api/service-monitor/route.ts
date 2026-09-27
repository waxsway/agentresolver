import { NextRequest, NextResponse } from "next/server";
import {
  parseServiceMonitorInput,
  runServiceMonitor,
  serviceMonitorInputFromQuery
} from "@/lib/serviceMonitor";

export const dynamic = "force-dynamic";

function cors(response: NextResponse<unknown>) {
  response.headers.set("cache-control", "no-store");
  response.headers.set("access-control-allow-origin", "*");
  return response;
}

function logCompletion(req: NextRequest, report: Awaited<ReturnType<typeof runServiceMonitor>>) {
  const source = req.nextUrl.searchParams.get("source")?.trim().slice(0, 64) || null;
  console.log(JSON.stringify({
    event: "service_monitor_completed",
    at: report.checkedAt,
    monitorId: report.monitorId,
    status: report.health.status,
    driftDetected: report.drift.detected,
    readinessScore: report.snapshot.readiness.score,
    mcpConfigured: Boolean(report.target.mcpEndpoint),
    x402Configured: Boolean(report.target.x402Endpoint),
    acquisitionSource: source,
    userAgent: req.headers.get("user-agent")?.slice(0, 160) || null
  }));
}

async function execute(req: NextRequest, input: unknown) {
  const parsed = parseServiceMonitorInput(input);
  const report = await runServiceMonitor(parsed);
  logCompletion(req, report);
  return report;
}

export async function GET(req: NextRequest) {
  try {
    const report = await runServiceMonitor(serviceMonitorInputFromQuery(req.nextUrl.searchParams));
    logCompletion(req, report);
    return cors(NextResponse.json(report));
  } catch (error) {
    return cors(NextResponse.json({
      error: "INVALID_MONITOR_REQUEST",
      message: error instanceof Error ? error.message : "Invalid monitor request."
    }, { status: 400 }));
  }
}

export async function POST(req: NextRequest) {
  try {
    return cors(NextResponse.json(await execute(req, await req.json().catch(() => null))));
  } catch (error) {
    return cors(NextResponse.json({
      error: "INVALID_MONITOR_REQUEST",
      message: error instanceof Error ? error.message : "Invalid monitor request."
    }, { status: 400 }));
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}
