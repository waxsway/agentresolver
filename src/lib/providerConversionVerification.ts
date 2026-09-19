import {
  BASE_NETWORK,
  BASE_USDC,
  verifyX402Settlement,
  type BaseRpc
} from "@/lib/x402SettlementVerify";
import {
  getProviderRoute,
  type ProviderRoute
} from "@/lib/providerNetwork";
import { isAttributionId } from "@/lib/transactionAttribution";

export type ProviderConversionVerifyInput = {
  attributionId: string;
  routeId: string;
  providerId: string;
  buyerTxHash: string;
};

function isBaseUsdcIdentity(route: ProviderRoute) {
  const identity = route.execute.paymentIdentity;
  return Boolean(
    identity &&
      identity.network === BASE_NETWORK &&
      identity.asset.toLowerCase() === BASE_USDC.toLowerCase() &&
      /^0x[0-9a-fA-F]{40}$/.test(identity.payTo) &&
      /^[0-9]+$/.test(identity.amountAtomic)
  );
}

export function parseProviderConversionVerifyInput(
  value: unknown
): ProviderConversionVerifyInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Provide a JSON conversion-verification request.");
  }
  const body = value as Record<string, unknown>;
  const attributionId =
    typeof body.attributionId === "string" ? body.attributionId.trim() : "";
  const routeId = typeof body.routeId === "string" ? body.routeId.trim() : "";
  const providerId =
    typeof body.providerId === "string" ? body.providerId.trim() : "";
  const buyerTxHash =
    typeof body.buyerTxHash === "string" ? body.buyerTxHash.trim() : "";

  if (!isAttributionId(attributionId)) {
    throw new Error("attributionId must be a valid AgentResolver attribution ID.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(routeId)) {
    throw new Error("routeId is invalid.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(providerId)) {
    throw new Error("providerId is invalid.");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(buyerTxHash)) {
    throw new Error("buyerTxHash must be a Base transaction hash.");
  }

  return { attributionId, routeId, providerId, buyerTxHash };
}

export async function verifyProviderConversion(
  input: ProviderConversionVerifyInput,
  options: {
    rpc?: BaseRpc;
    env?: Readonly<Record<string, string | undefined>>;
  } = {}
) {
  const route = getProviderRoute(input.routeId, options.env ?? process.env);
  if (!route || route.disclosure !== "provider-partner") {
    throw new Error("routeId is not a registered provider-partner route.");
  }
  if (route.providerId !== input.providerId) {
    throw new Error("providerId does not match the registered route.");
  }
  if (route.funding.model !== "provider-success-fee") {
    throw new Error("route is not enrolled in provider success-fee settlement.");
  }
  if (!isBaseUsdcIdentity(route)) {
    return {
      eligibleForFeeSettlement: false,
      attributionId: input.attributionId,
      routeId: route.routeId,
      providerId: route.providerId,
      buyerSettlementVerified: false,
      attributionVerified: false,
      reason: "provider_payment_identity_not_verifiable",
      settlement: null,
      attribution: {
        asserted: true,
        cryptographicallyVerified: false,
        limitation:
          "The supplied attribution ID is well-formed but AgentResolver does not yet persist or cryptographically sign provider handoff receipts, so this check does not prove that the verified buyer transaction originated from that handoff."
      }
    } as const;
  }

  const identity = route.execute.paymentIdentity!;
  const settlement = await verifyX402Settlement(
    {
      txHash: input.buyerTxHash,
      expectedPayTo: identity.payTo,
      expectedAmountAtomic: identity.amountAtomic
    },
    options.rpc ? { rpc: options.rpc } : {}
  );

  return {
    eligibleForFeeSettlement: settlement.settled,
    attributionId: input.attributionId,
    routeId: route.routeId,
    providerId: route.providerId,
    buyerSettlementVerified: settlement.settled,
    attributionVerified: false,
    reason: settlement.settled ? "buyer_settlement_verified" : settlement.verdict,
    settlement,
    attribution: {
      asserted: true,
      cryptographicallyVerified: false,
      limitation:
        "The Base USDC buyer settlement is independently verified against the registered provider payment identity. The supplied attribution ID is provider-asserted and is not yet independently bound to that buyer transaction."
    }
  } as const;
}
