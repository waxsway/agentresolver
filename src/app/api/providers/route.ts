import { NextResponse } from "next/server";
import { providerNetworkSnapshot } from "@/lib/providerNetwork";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const baseUrl = new URL(req.url).origin;
  return NextResponse.json({
    ...providerNetworkSnapshot(baseUrl),
    integration: {
      contract: baseUrl + "/provider-integration.json",
      providerPage: baseUrl + "/providers",
      registryConfiguration:
        "Partner routes are operator-reviewed and loaded from bounded machine-readable configuration. No caller can supply an arbitrary execution URL to /api/execute.",
      attributionHeader: "x-agentresolver-attribution-id"
    },
    analytics: {
      storage: "privacy_safe_structured_runtime_events",
      events: [
        "provider_demand_signal",
        "provider_route_handoff",
        "attributed_paid_response",
        "provider_attribution_fee_fulfilled"
      ],
      rawGoalsStored: false,
      rawIpStored: false,
      selfServeHistoricalDashboard: false,
      note:
        "Historical provider reporting is computed from runtime telemetry. Durable customer-facing analytics storage is intentionally not introduced until a storage service is explicitly approved."
    }
  }, {
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS"
    }
  });
}
