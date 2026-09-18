import { NextResponse } from "next/server";
import { normalizeX402ChallengeMethod, x402BuyerSetup } from "@/lib/x402BuyerSetup";
import { classifyTraffic, trafficLogFields } from "@/lib/trafficClassification";
import { PAID_CAPABILITIES } from "@/lib/paidCapabilities";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const traffic = classifyTraffic(req, {
    path: "/api/x402-client-setup",
    isDiscovery: true
  });

  const url = new URL(req.url);
  const source = url.searchParams.get("source") === "x402-challenge"
    ? "x402-challenge"
    : null;
  const requestedCapabilityId = url.searchParams.get("capabilityId");
  const challengeMethod = normalizeX402ChallengeMethod(url.searchParams.get("method"));
  const capabilityId =
    source === "x402-challenge" &&
    requestedCapabilityId &&
    Object.prototype.hasOwnProperty.call(PAID_CAPABILITIES, requestedCapabilityId)
      ? requestedCapabilityId
      : null;

  console.log(JSON.stringify({
    event: "buyer_setup_viewed",
    at: new Date().toISOString(),
    surface: "http",
    source,
    capabilityId,
    ...trafficLogFields(req, traffic)
  }));

  const capability = capabilityId
    ? PAID_CAPABILITIES[capabilityId as keyof typeof PAID_CAPABILITIES]
    : null;

  const responseHeaders: Record<string, string> = {
    "cache-control": "public, max-age=300",
    "access-control-allow-origin": "*"
  };

  if (capabilityId && capability) {
    const resumeUrl = new URL(capability.endpoint, "https://agentresolver.vercel.app").toString();
    responseHeaders["x-agentresolver-resume-url"] = resumeUrl;
    responseHeaders["x-agentresolver-resume-capability"] = capabilityId;
    if (challengeMethod) {
      responseHeaders["x-agentresolver-resume-method"] = challengeMethod;
    }
    responseHeaders["x-agentresolver-retry-header"] = "PAYMENT-SIGNATURE";
    responseHeaders["access-control-expose-headers"] = [
      "x-agentresolver-resume-url",
      "x-agentresolver-resume-capability",
      "x-agentresolver-resume-method",
      "x-agentresolver-retry-header"
    ].join(", ");
  }

  return NextResponse.json(
    x402BuyerSetup({
      source,
      capabilityId,
      endpoint: capability?.endpoint ?? null,
      method: challengeMethod,
      priceUsd: capability?.priceUsd ?? null,
      atomicAmount: capability?.atomicAmount ?? null
    }),
    { headers: responseHeaders }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS"
    }
  });
}
