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
import { isAttributionId } from "@/lib/transactionAttribution";

export type ProviderConversionVerifyInput = {
  attributionId: string;
  routeId: string;
  providerId: string;
  buyerTxHash: string;
  providerOrigin?: string;
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

  return {
    attributionId,
    routeId,
    providerId,
    buyerTxHash,
    ...(body.providerOrigin !== undefined
      ? { providerOrigin: providerOrigin(body.providerOrigin) }
      : {})
  };
}

async function resolveConversionRoute(
  input: ProviderConversionVerifyInput,
  env: Readonly<Record<string, string | undefined>>
): Promise<ConversionRoute | null> {
  const registered = getProviderRoute(input.routeId, env);
  if (registered && registered.disclosure === "provider-partner") {
    return { kind: "registered", route: registered };
  }

  if (!input.providerOrigin) return null;
  const routes = await fetchDomainProviderManifest(input.providerOrigin);
  const domain = routes.find(
    (route) =>
      route.routeId === input.routeId &&
      route.providerId === input.providerId
  );
  return domain ? { kind: "domain-manifest", route: domain } : null;
}

export async function verifyProviderConversion(
  input: ProviderConversionVerifyInput,
  options: {
    rpc?: BaseRpc;
    env?: Readonly<Record<string, string | undefined>>;
  } = {}
) {
  const resolved = await resolveConversionRoute(
    input,
    options.env ?? process.env
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
        limitation:
          "The supplied attribution ID is well-formed but AgentResolver does not yet persist or cryptographically sign procurement handoff receipts, so this check does not independently prove that the buyer transaction originated from that handoff."
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

  const successFeeQuote =
    settlement.settled && resolved.kind === "domain-manifest"
      ? quoteProviderSuccessFee(identity.amountAtomic)
      : settlement.settled
        ? {
            grossAmountAtomic: identity.amountAtomic,
            successFeeBps: null,
            minimumFeeAtomic: "1000",
            feeAmountAtomic: "1000",
            grossUsd: Number(identity.amountAtomic) / 1_000_000,
            feeUsd: 0.001
          }
        : null;

  return {
    eligibleForFeeSettlement: settlement.settled,
    attributionId: input.attributionId,
    routeId: routeId(resolved),
    providerId: routeProviderId(resolved),
    providerEnrollment: resolved.kind,
    buyerSettlementVerified: settlement.settled,
    attributionVerified: false,
    reason: settlement.settled ? "buyer_settlement_verified" : settlement.verdict,
    settlement,
    successFeeQuote,
    attribution: {
      asserted: true,
      cryptographicallyVerified: false,
      limitation:
        "The Base USDC buyer settlement is independently verified against the provider payment identity. The supplied attribution ID remains provider-asserted until AgentResolver introduces cryptographically signed procurement handoff receipts."
    }
  } as const;
}
