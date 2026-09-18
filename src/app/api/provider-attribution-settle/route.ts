import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { parseProviderSettlementInput } from "@/lib/providerAttributionSettlement";

export const dynamic = "force-dynamic";

const route = createDeterministicPaidRoute(
  "provider-attribution-settle",
  async (req) => {
    const input = parseProviderSettlementInput(await req.json().catch(() => null));
    console.log(JSON.stringify({
      event: "provider_attribution_fee_fulfilled",
      at: new Date().toISOString(),
      attributionId: input.attributionId,
      providerId: input.providerId,
      outcome: input.outcome,
      externalTransactionRefHash: input.externalTransactionRefHash
    }));
    return {
      accepted: true,
      settledDelivery: true,
      attributionId: input.attributionId,
      providerId: input.providerId,
      outcome: input.outcome,
      externalTransactionRefHash: input.externalTransactionRefHash,
      feeUsd: 0.001,
      proofScope: "provider_paid_agentresolver_attribution_fee",
      underlyingBuyerTransactionVerified: false,
      note:
        "This paid receipt proves AgentResolver delivered the attribution-fee acknowledgment after x402 settlement. It does not independently prove the provider's underlying buyer transaction or fulfillment."
    };
  }
);

export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
