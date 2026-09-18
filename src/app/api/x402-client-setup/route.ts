import { NextResponse } from "next/server";
import { normalizeX402ChallengeMethod, normalizeX402ChallengeResumeUrl, x402BuyerSetup, x402BuyerSetupCompact, type X402BuyerSetupContext } from "@/lib/x402BuyerSetup";
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
  const requestedResumeUrl = url.searchParams.get("resumeUrl");
  const challengeMethod = normalizeX402ChallengeMethod(url.searchParams.get("method"));
  const capabilityId =
    source === "x402-challenge" &&
    requestedCapabilityId &&
    Object.prototype.hasOwnProperty.call(PAID_CAPABILITIES, requestedCapabilityId)
      ? requestedCapabilityId
      : null;

  const setupMode = source === "x402-challenge" && capabilityId
    ? "challenge_compact"
    : "full";

  console.log(JSON.stringify({
    event: "buyer_setup_viewed",
    at: new Date().toISOString(),
    surface: "http",
    source,
    capabilityId,
    setupMode,
    ...trafficLogFields(req, traffic)
  }));

  const capability = capabilityId
    ? PAID_CAPABILITIES[capabilityId as keyof typeof PAID_CAPABILITIES]
    : null;
  const resumeUrl = capability
    ? normalizeX402ChallengeResumeUrl(requestedResumeUrl, capability.endpoint) ??
      new URL(capability.endpoint, "https://agentresolver.vercel.app").toString()
    : null;

  const responseHeaders: Record<string, string> = {
    "cache-control": "public, max-age=300",
    "access-control-allow-origin": "*"
  };

  if (capabilityId && capability) {
    const responseResumeUrl =
      resumeUrl ?? new URL(capability.endpoint, "https://agentresolver.vercel.app").toString();
    responseHeaders["x-agentresolver-resume-url"] = responseResumeUrl;
    responseHeaders["x-agentresolver-resume-capability"] = capabilityId;
    if (challengeMethod) {
      responseHeaders["x-agentresolver-resume-method"] = challengeMethod;
    }
    responseHeaders["x-agentresolver-retry-header"] = "PAYMENT-SIGNATURE";
    responseHeaders["x-agentresolver-setup-mode"] = "challenge_compact";
    responseHeaders["access-control-expose-headers"] = [
      "x-agentresolver-resume-url",
      "x-agentresolver-resume-capability",
      "x-agentresolver-resume-method",
      "x-agentresolver-retry-header",
      "x-agentresolver-setup-mode"
    ].join(", ");
  }

  const setupContext: X402BuyerSetupContext = {
    source,
    capabilityId,
    endpoint: capability?.endpoint ?? null,
    resumeUrl,
    method: challengeMethod,
    priceUsd: capability?.priceUsd ?? null,
    atomicAmount: capability?.atomicAmount ?? null
  };

  return NextResponse.json(
    setupMode === "challenge_compact"
      ? x402BuyerSetupCompact(setupContext)
      : x402BuyerSetup(setupContext),
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
