import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getProviderRoute,
  getProviderRouteByCapability
} from "@/lib/providerNetwork";
import {
  ATTRIBUTION_HEADER,
  buildTransactionAttribution,
  isAttributionId
} from "@/lib/transactionAttribution";
import { callerHash, safeUserAgent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";
const MAX_INPUT_BYTES = 32_768;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        routeId?: unknown;
        capabilityId?: unknown;
        input?: unknown;
        attributionId?: unknown;
      }
    | null;

  if (!body) {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Provide a JSON execution-routing request." },
      { status: 400 }
    );
  }

  const routeId = typeof body.routeId === "string" ? body.routeId.trim() : "";
  const capabilityId =
    typeof body.capabilityId === "string" ? body.capabilityId.trim() : "";
  const existingAttributionId = isAttributionId(body.attributionId)
    ? body.attributionId
    : null;

  let inputSize = 0;
  try {
    inputSize = body.input === undefined ? 0 : Buffer.byteLength(JSON.stringify(body.input), "utf8");
  } catch {
    inputSize = MAX_INPUT_BYTES + 1;
  }
  if (inputSize > MAX_INPUT_BYTES) {
    return NextResponse.json(
      { error: "INPUT_TOO_LARGE", message: "Execution handoff input must be 32768 bytes or fewer." },
      { status: 413 }
    );
  }

  const route = routeId
    ? getProviderRoute(routeId)
    : capabilityId
      ? getProviderRouteByCapability(capabilityId)
      : null;

  if (!route) {
    return NextResponse.json(
      {
        error: "UNREGISTERED_PROVIDER_ROUTE",
        message:
          "Provide a registered routeId or capabilityId from /api/providers. Arbitrary target URLs are never proxied."
      },
      { status: 404 }
    );
  }

  const requestId = randomUUID();
  const attribution = buildTransactionAttribution({
    route,
    routeInput: body.input,
    existingAttributionId
  });

  console.log(JSON.stringify({
    event: "provider_route_handoff",
    at: new Date().toISOString(),
    requestId,
    attributionId: attribution.attributionId,
    callerHash: callerHash(req),
    userAgent: safeUserAgent(req),
    routeId: route.routeId,
    providerId: route.providerId,
    capabilityId: route.capabilityId,
    fundingModel: route.funding.model,
    targetPriceUsd: route.execute.priceUsd,
    targetMethod: route.execute.method
  }));

  return NextResponse.json({
    requestId,
    action: "registered_provider_handoff",
    route: {
      routeId: route.routeId,
      providerId: route.providerId,
      providerName: route.providerName,
      capabilityId: route.capabilityId,
      name: route.name,
      disclosure: route.disclosure,
      sponsored: route.sponsored
    },
    attribution,
    execute: {
      method: route.execute.method,
      url: route.execute.url,
      body: route.execute.method === "POST" ? body.input ?? {} : undefined,
      queryInput: route.execute.method === "GET" ? body.input ?? {} : undefined,
      headers: {
        [ATTRIBUTION_HEADER]: attribution.attributionId
      },
      payment: {
        protocol: "x402",
        priceUsd: route.execute.priceUsd,
        asset: route.execute.asset,
        networks: route.execute.networks,
        paymentIdentity: route.execute.paymentIdentity,
        spendingAuthorized: false
      }
    },
    providerFunding: route.funding,
    safety: {
      arbitraryProxying: false,
      targetRequestExecutedByAgentResolver: false,
      walletKeysAccepted: false,
      paymentSignaturesForwarded: false,
      authorizationHeadersForwarded: false,
      callerMustIndependentlyAuthorizeTargetSpend: true
    },
    next:
      "Call the returned registered endpoint directly under the caller's own trust and spending policy. Preserve x-agentresolver-attribution-id. If this provider route exposes a registered Base-USDC payment identity, the provider can later prove the buyer settlement to AgentResolver before paying the success fee."
  }, {
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": ATTRIBUTION_HEADER,
      [ATTRIBUTION_HEADER]: attribution.attributionId
    }
  });
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
