import { NextResponse } from "next/server";
import {
  EXECUTION_EVIDENCE_URL,
  EXECUTION_EVIDENCE_VERSION
} from "@/lib/executionEvidence";
import { AGENTRESOLVER_TRUST_CONTRACT } from "@/lib/trustContract";

export const dynamic = "force-dynamic";

export function GET() {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || null;

  return NextResponse.json(
    {
      schemaVersion: EXECUTION_EVIDENCE_VERSION,
      service: "AgentResolver",
      canonicalOrigin: "https://agentresolver.vercel.app",
      model: "trust-minimized-verifiable-execution",
      evidenceUrl: EXECUTION_EVIDENCE_URL,
      claims: {
        callerControlsPaymentAuthorization: true,
        nonCustodial: true,
        responseDeliveryCanBeHashed: true,
        deployedSourceCanBeInspected: commitSha !== null,
        settlementCanBeVerifiedIndependently: true,
        providerLegitimacyGuaranteed: false,
        futureFulfillmentGuaranteed: false
      },
      responseEvidence: {
        digestAlgorithm: "sha256",
        digestInput: "exact UTF-8 JSON response payload before HTTP content encoding",
        headers: {
          executionId: "x-agentresolver-execution-id",
          responseSha256: "x-agentresolver-response-sha256",
          deploymentCommitSha: "x-agentresolver-deployment",
          evidenceContract: "x-agentresolver-evidence"
        },
        verification: [
          "Hash the decoded UTF-8 response payload with SHA-256 and compare it with x-agentresolver-response-sha256.",
          "Use x-agentresolver-deployment to inspect the exact deployed source commit.",
          "Decode PAYMENT-RESPONSE after settlement and independently verify the referenced transaction on its network."
        ]
      },
      settlementEvidence: {
        protocol: "x402",
        challengeHeader: "payment-required",
        settlementHeader: "payment-response",
        supported: AGENTRESOLVER_TRUST_CONTRACT.supportedSettlement,
        independentVerificationRecommended: true
      },
      deployment: {
        commitSha,
        sourceRepository: "https://github.com/waxsway/agentresolver",
        sourceCommitUrl: commitSha
          ? `https://github.com/waxsway/agentresolver/commit/${commitSha}`
          : null,
        environment: process.env.VERCEL_ENV || null
      },
      historicalReputation: {
        aggregatePublished: true,
        syntheticTrustScorePublished: false,
        interpretation:
          "Versioned x402 settlement history whose verified counts require an independent public-chain USDC transfer check.",
        scope:
          "Only paid_capability_settled runtime events with public transaction references can become independently verified. Crawls, registrations, 402 challenges, unsigned requests, traffic volume, and unverified payment attempts are excluded.",
        aggregateUrl:
          "https://agentresolver.vercel.app/.well-known/agentresolver-reputation.json",
        durableSourceUrl:
          "https://raw.githubusercontent.com/waxsway/agentresolver/evidence-history/evidence/settlements.json",
        versionHistoryUrl:
          "https://github.com/waxsway/agentresolver/commits/evidence-history/evidence/settlements.json",
        independentlyVerifiableOnchain: true
      },
      limitations: [
        "Execution evidence proves what this AgentResolver deployment returned for a successful paid call; it does not prove a third-party provider is legitimate.",
        "A deployment commit link improves inspectability but is not a substitute for an independent security review.",
        "Settlement evidence should be checked against the relevant network rather than accepted solely because AgentResolver returned it.",
        "The public settlement history is derived from first-party runtime telemetry and versioned in Git; it is not an independent or on-chain reputation registry."
      ]
    },
    {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
        "access-control-allow-origin": "*"
      }
    }
  );
}
