import {
  parseProviderConversionVerifyInput,
  verifyProviderConversion,
  type ProviderConversionVerifyInput,
  type ProviderConversionVerifyOptions
} from "@/lib/providerConversionVerification";
import {
  BASE_NETWORK,
  BASE_USDC,
  verifyBaseUsdcTransfer,
  type BaseRpc
} from "@/lib/x402SettlementVerify";
import { X402_PAY_TO } from "@/lib/x402Config";

export type ProviderSuccessFeeVerifyInput =
  ProviderConversionVerifyInput & {
    feeTxHash: string;
  };

export function parseProviderSuccessFeeVerifyInput(
  value: unknown
): ProviderSuccessFeeVerifyInput {
  const conversion = parseProviderConversionVerifyInput(value);
  const body = value as Record<string, unknown>;
  const feeTxHash =
    typeof body.feeTxHash === "string" ? body.feeTxHash.trim() : "";

  if (!/^0x[0-9a-fA-F]{64}$/.test(feeTxHash)) {
    throw new Error("feeTxHash must be a Base transaction hash.");
  }

  return { ...conversion, feeTxHash };
}

export async function quoteVerifiedProviderSuccessFee(
  input: ProviderConversionVerifyInput,
  options: ProviderConversionVerifyOptions & {
    payTo?: string;
  } = {}
) {
  const conversion = await verifyProviderConversion(input, options);
  if (!conversion.eligibleForFeeSettlement || !conversion.successFeeQuote) {
    throw new Error(
      "Underlying buyer settlement is not verified; no provider success fee is due."
    );
  }

  const payTo = (options.payTo || process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) {
    throw new Error("AgentResolver Base fee recipient is invalid.");
  }

  return {
    schemaVersion: 1,
    attributionId: input.attributionId,
    providerId: input.providerId,
    routeId: input.routeId,
    providerEnrollment: conversion.providerEnrollment,
    buyerSettlementVerified: true,
    attributionVerified: conversion.attributionVerified,
    attribution: conversion.attribution,
    buyerSettlement: conversion.settlement,
    commercial: {
      model:
        conversion.providerEnrollment === "domain-manifest"
          ? "two-percent-provider-success-fee"
          : "legacy-fixed-provider-success-fee",
      quote: conversion.successFeeQuote
    },
    payment: {
      network: BASE_NETWORK,
      asset: BASE_USDC,
      payTo,
      amountAtomic: conversion.successFeeQuote.feeAmountAtomic,
      amountUsd: conversion.successFeeQuote.feeUsd,
      exactAmountRequired: true,
      attributionBound:
        "attributionBound" in conversion.successFeeQuote
          ? conversion.successFeeQuote.attributionBound
          : false
    },
    boundaries: {
      buyerPaysAgentResolverExtraFee: false,
      providerPaysSuccessFee: true,
      AgentResolverCustodiesBuyerFunds: false,
      feeTransferAuthorizesFutureSpend: false
    }
  } as const;
}

export async function verifyProviderSuccessFee(
  input: ProviderSuccessFeeVerifyInput,
  options: ProviderConversionVerifyOptions & {
    payTo?: string;
  } = {}
) {
  const quote = await quoteVerifiedProviderSuccessFee(input, options);
  const feeSettlement = await verifyBaseUsdcTransfer(
    {
      txHash: input.feeTxHash,
      expectedPayTo: quote.payment.payTo,
      expectedAmountAtomic: quote.payment.amountAtomic
    },
    options.rpc ? { rpc: options.rpc } : {}
  );

  return {
    ...quote,
    feeSettlementVerified: feeSettlement.settled,
    feeSettlement,
    settled: feeSettlement.settled,
    proofScope:
      feeSettlement.settled
        ? "verified_provider_buyer_settlement_plus_attribution_bound_agentresolver_success_fee_transfer"
        : "buyer_settlement_verified_but_agentresolver_success_fee_not_verified",
    limitation:
      quote.attributionVerified
        ? "The buyer settlement, AgentResolver-issued signed procurement handoff receipt, and provider success-fee transfer are independently verified. This proves AgentResolver issued the exact attributed route/payment handoff; it does not prove the eventual buyer's legal identity."
        : "The buyer settlement and provider fee transfer are independently verified on Base. The attribution ID is bound into the exact fee amount, but this runtime has not cryptographically verified an AgentResolver-issued handoff receipt."
  } as const;
}
