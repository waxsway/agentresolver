import { NextResponse } from "next/server";
import { providerNetworkSnapshot } from "@/lib/providerNetwork";
import {
  PROVIDER_MANIFEST_PATH,
  PROVIDER_SUCCESS_FEE_BPS,
  PROVIDER_SUCCESS_FEE_MIN_USD
} from "@/lib/providerManifest";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const baseUrl = new URL(req.url).origin.replace(/\/$/, "");

  return NextResponse.json({
    ...providerNetworkSnapshot(baseUrl),
    domainEnrollment: {
      status: "open",
      accountRequired: false,
      emailRequired: false,
      operatorReviewRequired: false,
      manifestPath: PROVIDER_MANIFEST_PATH,
      example: baseUrl + "/provider-manifest.example.json",
      docs: baseUrl + "/provider-onboarding.md",
      sameOriginRoutesOnly: true,
      liveX402ChallengeRequired: true,
      unsignedEnrollmentProbeOnly: true,
      settlementNetwork: "eip155:8453",
      asset: "Base USDC",
      discoveryBehavior:
        "When a catalog-discovered x402 resource has a valid same-origin AgentResolver provider manifest and its live unsigned x402 v2 challenge exactly matches the manifest payment identity, procurement can attach provider commercial terms and an attribution handoff without adding the route to AgentResolver configuration."
    },
    integration: {
      contract: baseUrl + "/provider-integration.json",
      providerPage: baseUrl + "/providers",
      attributionHeader: "x-agentresolver-attribution-id",
      procurement: baseUrl + "/api/procure",
      conversionVerification: baseUrl + "/api/provider-attribution-verify",
      successFeeQuote: baseUrl + "/api/provider-success-fee-quote",
      successFeeVerification: baseUrl + "/api/provider-success-fee-verify",
      paidLaunchCheck: baseUrl + "/api/provider-launch-check",
      paidLaunchCheckRequiredForEnrollment: false,
      onboardingDocs: baseUrl + "/provider-onboarding.md"
    },
    sellerMonetization: {
      model: "provider-success-fee",
      successFeeBps: PROVIDER_SUCCESS_FEE_BPS,
      minimumSuccessFeeUsd: PROVIDER_SUCCESS_FEE_MIN_USD,
      buyerExtraFeeUsd: 0,
      feePaidAfterVerifiedBuyerSettlement: true,
      feeProofReplayResistance:
        "The exact fee quote contains an attribution-bound atomic-unit suffix.",
      legacyFixedFeeSettlement: baseUrl + "/api/provider-attribution-settle"
    },
    analytics: {
      storage: "privacy_safe_structured_runtime_events",
      events: [
        "procurement_call",
        "provider_conversion_verification",
        "provider_success_fee_quote",
        "provider_success_fee_verification"
      ],
      rawGoalsStored: false,
      rawIpStored: false,
      selfServeHistoricalDashboard: false
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
