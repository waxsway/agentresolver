import { getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import {
  AGENT_SKILLS_INDEX_URL,
  PAYMENT_GUARD_SKILL_URL,
  X402_BUYER_SETUP_URL
} from "@/lib/x402BuyerSetup";
import { VERIFIED_SETTLEMENT_HISTORY_URL } from "@/lib/executionEvidence";

const PAYMENT_GUARD_URL = "https://agentresolver.vercel.app/api/payment-guard" as const;
const TRUST_URL = "https://agentresolver.vercel.app/.well-known/agentresolver-trust.json" as const;

export function x402BuyerChallengeExtension(capabilityId: PaidCapabilityId) {
  const capability = getPaidCapability(capabilityId);
  return {
    schemaVersion: 1,
    capabilityId: capability.id,
    priceUsd: capability.priceUsd,
    costClass: capability.costClass,
    buyerSetup: X402_BUYER_SETUP_URL,
    agentSkillsIndex: AGENT_SKILLS_INDEX_URL,
    paymentGuardSkill: PAYMENT_GUARD_SKILL_URL,
    paymentGuard: PAYMENT_GUARD_URL,
    trust: TRUST_URL,
    settlementHistory: VERIFIED_SETTLEMENT_HISTORY_URL,
    authorizationBoundary: {
      callerMustAuthorizePayment: true,
      agentResolverAuthorizesSpend: false,
      agentResolverReceivesWalletSecrets: false
    },
    instruction:
      capabilityId === "x402-payment-preflight"
        ? "This challenge quotes AgentResolver Guard only. The caller must separately authorize its $0.001 fee; an eligible Guard result never authorizes the target payment."
        : "If the host cannot create PAYMENT-SIGNATURE, use buyerSetup. Before an unfamiliar target x402 spend, run paymentGuard; the caller alone authorizes every spend."
  } as const;
}
