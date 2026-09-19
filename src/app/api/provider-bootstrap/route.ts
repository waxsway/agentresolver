import { NextResponse } from "next/server";
import {
  buildProviderBootstrap,
  PROVIDER_BOOTSTRAP_MAX_ROUTES
} from "@/lib/providerBootstrap";
import { callerHash, safeUserAgent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { origin?: unknown; routeIds?: unknown }
    | null;

  if (!body || typeof body.origin !== "string") {
    return NextResponse.json(
      {
        error: "INVALID_PROVIDER_BOOTSTRAP",
        message: "Provide a public HTTPS provider origin."
      },
      { status: 400 }
    );
  }

  const routeIds =
    body.routeIds === undefined
      ? undefined
      : Array.isArray(body.routeIds) &&
          body.routeIds.every((value) => typeof value === "string")
        ? body.routeIds as string[]
        : null;

  if (routeIds === null || (routeIds && routeIds.length > PROVIDER_BOOTSTRAP_MAX_ROUTES)) {
    return NextResponse.json(
      {
        error: "INVALID_PROVIDER_BOOTSTRAP",
        message:
          `routeIds must be an array of at most ${PROVIDER_BOOTSTRAP_MAX_ROUTES} route IDs.`
      },
      { status: 400 }
    );
  }

  try {
    const report = await buildProviderBootstrap({
      origin: body.origin,
      ...(routeIds ? { routeIds } : {})
    });

    console.log(JSON.stringify({
      event: "provider_bootstrap",
      at: new Date().toISOString(),
      callerHash: callerHash(req),
      userAgent: safeUserAgent(req),
      providerId: report.provider.id,
      manifestRouteCount: report.manifestRouteCount,
      checkedRouteCount: report.checkedRouteCount,
      verifiedRouteCount: report.verifiedRoutes.length,
      rejectedRouteCount: report.rejectedRoutes.length,
      truncated: report.truncated
    }));

    return NextResponse.json(report, {
      status: report.verifiedRoutes.length > 0 ? 200 : 422,
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "PROVIDER_BOOTSTRAP_FAILED",
        message:
          error instanceof Error ? error.message : "Provider bootstrap failed."
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
