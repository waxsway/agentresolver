import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { parseProviderSettlementInput } from "@/lib/providerAttributionSettlement";
import { verifyProviderConversion } from "@/lib/providerConversionVerification";

export const dynamic = "force-dynamic";

const route = createDeterministicPaidRoute(
  "provider-attribution-settle",
  async (req) => {
    const input = parseProviderSettlementInput(
      await req.json().catch(() => null)
    );

    const conversion =
      input.outcome === "fulfilled"
        ? await verifyProviderConversion({
            attributionId: input.attributionId,
            routeId: input.routeId,
            providerId: input.providerId,
            buyerTxHash: input.buyerTxHash
          })
        : null;

    if (conversion && !conversion.eligibleForFeeSettlement) {
      throw new Error(
        "Underlying buyer settlement did not verify against the registered provider payment identity. Use the free /api/provider-attribution-verify precheck before paying this success fee."
      );
    }

    console.log(JSON.stringify({
      event: "provider_attribution_fee_fulfilled",
      at: new Date().toISOString(),
      attributionId: input.attributionId,
      providerId: input.providerId,
      routeId: input.routeId,
      outcome: input.outcome,
      buyerSettlementVerified: conversion?.buyerSettlementVerified ?? false,
      attributionCryptographicallyVerified:
        conversion?.attribution.cryptographicallyVerified ?? false,
      externalTransactionRefHash: input.externalTransactionRefHash
    }));

    return {
      accepted: true,
      settledDelivery: true,
      attributionId: input.attributionId,
      providerId: input.providerId,
      routeId: input.routeId,
      outcome: input.outcome,
      externalTransactionRefHash: input.externalTransactionRefHash,
      feeUsd: 0.001,
      proofScope:
        input.outcome === "fulfilled"
          ? "provider_paid_agentresolver_success_fee_after_verified_base_usdc_buyer_settlement"
          : "provider_paid_agentresolver_qualified_lead_fee",
      underlyingBuyerTransactionVerified:
        conversion?.buyerSettlementVerified ?? false,
      attributionCryptographicallyVerified:
        conversion?.attribution.cryptographicallyVerified ?? false,
      buyerSettlement:
        conversion?.settlement ?? null,
      note:
        input.outcome === "fulfilled"
          ? "The provider's underlying Base USDC settlement was independently verified against the registered provider payment identity before this receipt was returned. The attribution ID remains provider-asserted until AgentResolver introduces cryptographically signed handoff receipts."
          : "This receipt proves the provider paid AgentResolver's qualified-lead fee. It does not claim that an underlying buyer settlement occurred."
    };
  }
);

export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
