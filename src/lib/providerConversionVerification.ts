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
import {
  fetchDomainProviderManifest,
  quoteProviderSuccessFee,
  type DomainProviderRoute
} from "@/lib/providerManifest";
import { validatePublicHttpsUrl } from "@/lib/publicHttpsJson";
import { MAX_ATTRIBUTION_RECEIPT_LENGTH } from "@/lib/attributionReceipt";
import {
  attributionSigningConfigured,
  verifyHistoricalAttributionReceipt
} from "@/lib/attributionReceiptRuntime";
import { isAttributionId } from "@/lib/transactionAttribution";

export type ProviderConversionVerifyInput = {
  attributionId: string;
  routeId: string;
  providerId: string;
  buyerTxHash: string;
  providerOrigin?: string;
  attributionReceipt?: string;
};

export type ProviderConversionVerifyOptions = {
  rpc?: BaseRpc;
  env?: Readonly<Record<string, string | undefined>>;
  manifestFetcher?: (resourceUrl: string) => Promise<DomainProviderRoute[]>;
};

type ConversionRoute =
  | { kind: "registered"; route: ProviderRoute }
  | { kind: "domain-manifest"; route: DomainProviderRoute };

function staticRouteIdentity(route: ProviderRoute) {
  const identity = route.execute.paymentIdentity;
  if (
    !identity ||
    identity.network !== BASE_NETWORK ||
    identity.asset.toLowerCase() !== BASE_USDC.toLowerCase() ||
    !/^0x[0-9a-fA-F]{40}$/.test(identity.payTo) ||
    !/^[0-9]+$/.test(identity.amountAtomic)
  ) return null;

  return {
    network: BASE_NETWORK,
    asset: BASE_USDC,
    payTo: identity.payTo,
    amountAtomic: identity.amountAtomic
  } as const;
}

function routeIdentity(resolved: ConversionRoute) {
  if (resolved.kind === "domain-manifest") {
    return {
      network: resolved.route.network,
      asset: resolved.route.asset,
      payTo: resolved.route.payTo,
      amountAtomic: resolved.route.amountAtomic
    } as const;
  }
  return staticRouteIdentity(resolved.route);
}

function routeProviderId(resolved: ConversionRoute) {
  return resolved.route.providerId;
}

function routeId(resolved: ConversionRoute) {
  return resolved.route.routeId;
}


function routeCapabilityId(resolved: ConversionRoute) {
  return resolved.route.capabilityId;
}

function routeExecution(resolved: ConversionRoute) {
  if (resolved.kind === "domain-manifest") {
    return {
      method: resolved.route.method,
      url: resolved.route.endpoint,
      priceUsd: resolved.route.priceUsd
    } as const;
  }
  return {
    method: resolved.route.execute.method,
    url: resolved.route.execute.url,
    priceUsd: resolved.route.execute.priceUsd
  } as const;
}

function providerOrigin(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error("providerOrigin must be a public HTTPS origin.");
  }
  const url = validatePublicHttpsUrl(value.trim());
  if (url.pathname !== "/" || url.search) {
    throw new Error("providerOrigin must be an HTTPS origin without a path or query.");
  }
  return url.origin;
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
  const attributionReceipt =
    typeof body.attributionReceipt === "string"
      ? body.attributionReceipt.trim()
      : "";

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
  if (attributionReceipt.length > MAX_ATTRIBUTION_RECEIPT_LENGTH) {
    throw new Error("attributionReceipt exceeds the maximum supported size.");
  }

  return {
    attributionId,
    routeId,
    providerId,
    buyerTxHash,
    ...(attributionReceipt ? { attributionReceipt } : {}),
    ...(body.providerOrigin !== undefined
      ? { providerOrigin: providerOrigin(body.providerOrigin) }
      : {})
  };
}

async function resolveConversionRoute(
  input: ProviderConversionVerifyInput,
  env: Readonly<Record<string, string | undefined>>,
  manifestFetcher: (resourceUrl: string) => Promise<DomainProviderRoute[]>
): Promise<ConversionRoute | null> {
  const registered = getProviderRoute(input.routeId, env);
  if (registered && registered.disclosure === "provider-partner") {
    return { kind: "registered", route: registered };
  }

  if (!input.providerOrigin) return null;
  const routes = await manifestFetcher(input.providerOrigin);
  const domain = routes.find(
    (route) =>
      route.routeId === input.routeId &&
      route.providerId === input.providerId
  );
  return domain ? { kind: "domain-manifest", route: domain } : null;
}

export async function verifyProviderConversion(
  input: ProviderConversionVerifyInput,
  options: ProviderConversionVerifyOptions = {}
) {
  const resolved = await resolveConversionRoute(
    input,
    options.env ?? process.env,
    options.manifestFetcher ?? fetchDomainProviderManifest
  );

  if (!resolved) {
    throw new Error(
      "routeId is not a registered provider route and no matching domain-controlled provider manifest was found."
    );
  }

  if (routeProviderId(resolved) !== input.providerId) {
    throw new Error("providerId does not match the provider route.");
  }

  if (
    resolved.kind === "registered" &&
    resolved.route.funding.model !== "provider-success-fee"
  ) {
    throw new Error("route is not enrolled in provider success-fee settlement.");
  }

  const identity = routeIdentity(resolved);
  if (!identity) {
    return {
      eligibleForFeeSettlement: false,
      attributionId: input.attributionId,
      routeId: routeId(resolved),
      providerId: routeProviderId(resolved),
      providerEnrollment: resolved.kind,
      buyerSettlementVerified: false,
      attributionVerified: false,
      reason: "provider_payment_identity_not_verifiable",
      settlement: null,
      successFeeQuote: null,
      attribution: {
        asserted: true,
        cryptographicallyVerified: false,
        receiptRequired: attributionSigningConfigured(options.env ?? process.env),
        limitation:
          "The provider payment identity is not verifiable, so AgentResolver cannot bind a buyer settlement or signed handoff receipt to this route."
      }
    } as const;
  }

  const env = options.env ?? process.env;
  const signingConfigured = attributionSigningConfigured(env);
  const execution = routeExecution(resolved);
  const receiptVerification =
    signingConfigured && input.attributionReceipt
      ? verifyHistoricalAttributionReceipt(
          input.attributionReceipt,
          {
            attributionId: input.attributionId,
            routeId: routeId(resolved),
            providerId: routeProviderId(resolved),
            capabilityId: routeCapabilityId(resolved),
            execute: {
              method: execution.method,
              url: execution.url,
              priceUsd: execution.priceUsd,
              network: identity.network,
              asset: identity.asset,
              payTo: identity.payTo,
              amountAtomic: identity.amountAtomic
            }
          },
          env
        )
      : null;

  if (signingConfigured && !receiptVerification?.valid) {
    return {
      eligibleForFeeSettlement: false,
      attributionId: input.attributionId,
      routeId: routeId(resolved),
      providerId: routeProviderId(resolved),
      providerEnrollment: resolved.kind,
      buyerSettlementVerified: false,
      attributionVerified: false,
      reason: input.attributionReceipt
        ? `attribution_receipt_${receiptVerification?.reason || "invalid"}`
        : "attribution_receipt_required",
      settlement: null,
      successFeeQuote: null,
      attribution: {
        asserted: true,
        cryptographicallyVerified: false,
        receiptRequired: true,
        limitation:
          "A dedicated attribution signing secret is active, so provider fee eligibility requires the exact AgentResolver-issued signed handoff receipt."
      }
    } as const;
  }

  const settlement = await verifyX402Settlement(
    {
      txHash: input.buyerTxHash,
      expectedPayTo: identity.payTo,
      expectedAmountAtomic: identity.amountAtomic
    },
    options.rpc ? { rpc: options.rpc } : {}
  );

  let settlementWindowStatus:
    | "verified"
    | "timestamp_unavailable"
    | "before_window"
    | "after_window"
    | null = null;

  if (signingConfigured && receiptVerification?.valid && settlement.settled) {
    if (!settlement.blockTimestamp) {
      settlementWindowStatus = "timestamp_unavailable";
    } else {
      const settlementMs = Date.parse(settlement.blockTimestamp);
      const issuedMs = Date.parse(receiptVerification.payload.issuedAt);
      const expiresMs = Date.parse(receiptVerification.payload.expiresAt);
      if (!Number.isFinite(settlementMs)) {
        settlementWindowStatus = "timestamp_unavailable";
      } else if (settlementMs < issuedMs) {
        settlementWindowStatus = "before_window";
      } else if (settlementMs > expiresMs) {
        settlementWindowStatus = "after_window";
      } else {
        settlementWindowStatus = "verified";
      }
    }
  }

  const eligibleForFeeSettlement =
    settlement.settled &&
    (!signingConfigured || settlementWindowStatus === "verified");

  const successFeeQuote =
    eligibleForFeeSettlement && resolved.kind === "domain-manifest"
      ? quoteProviderSuccessFee(identity.amountAtomic, input.attributionId)
      : eligibleForFeeSettlement
        ? {
            grossAmountAtomic: identity.amountAtomic,
            successFeeBps: null,
            minimumFeeAtomic: "1000",
            feeAmountAtomic: "1000",
            grossUsd: Number(identity.amountAtomic) / 1_000_000,
            feeUsd: 0.001
          }
        : null;

  const reason = !settlement.settled
    ? settlement.verdict
    : !signingConfigured
      ? "buyer_settlement_verified_legacy_attribution"
      : settlementWindowStatus === "verified"
        ? "buyer_settlement_and_attribution_receipt_verified"
        : settlementWindowStatus === "timestamp_unavailable"
          ? "buyer_settlement_timestamp_unavailable"
          : settlementWindowStatus === "before_window"
            ? "buyer_settlement_before_attribution_window"
            : "buyer_settlement_after_attribution_window";

  return {
    eligibleForFeeSettlement,
    attributionId: input.attributionId,
    routeId: routeId(resolved),
    providerId: routeProviderId(resolved),
    providerEnrollment: resolved.kind,
    buyerSettlementVerified: settlement.settled,
    attributionVerified: Boolean(receiptVerification?.valid),
    reason,
    settlement,
    successFeeQuote,
    attribution: {
      asserted: true,
      cryptographicallyVerified: Boolean(receiptVerification?.valid),
      receiptRequired: signingConfigured,
      receiptIssuedAt: receiptVerification?.valid
        ? receiptVerification.payload.issuedAt
        : null,
      receiptExpiresAt: receiptVerification?.valid
        ? receiptVerification.payload.expiresAt
        : null,
      buyerSettlementAt: settlement.blockTimestamp,
      settlementWithinReceiptWindow:
        signingConfigured && settlement.settled
          ? settlementWindowStatus === "verified"
          : null,
      limitation: receiptVerification?.valid
        ? "AgentResolver authenticated the signed procurement handoff independently of proof-submission time. Fee eligibility additionally requires the verified buyer settlement block timestamp to fall inside the receipt issuedAt/expiresAt window; proof may be submitted later."
        : "The Base USDC buyer settlement is independently verified against the provider payment identity, but no dedicated signing secret is configured in this runtime so attribution remains explicitly legacy/provider-asserted."
    }
  } as const;
}
