import { randomUUID } from "node:crypto";
import { shortHash } from "@/lib/telemetry";
import type { ProviderRoute } from "@/lib/providerNetwork";

export const ATTRIBUTION_HEADER = "x-agentresolver-attribution-id";

export function isAttributionId(value: unknown): value is string {
  return typeof value === "string" &&
    /^atr_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function attributionIdFromRequest(req: Request): string | null {
  const value = req.headers.get(ATTRIBUTION_HEADER);
  return isAttributionId(value) ? value : null;
}

function inputFingerprint(input: unknown): string | null {
  if (input === undefined) return null;
  try {
    const encoded = JSON.stringify(input);
    return encoded.length <= 32_768 ? shortHash(encoded) : shortHash(encoded.slice(0, 32_768));
  } catch {
    return null;
  }
}

export function buildTransactionAttribution(input: {
  route: ProviderRoute;
  goal?: string;
  routeInput?: unknown;
  existingAttributionId?: string | null;
}) {
  const attributionId = isAttributionId(input.existingAttributionId)
    ? input.existingAttributionId
    : "atr_" + randomUUID();

  return {
    schemaVersion: 1,
    attributionId,
    createdAt: new Date().toISOString(),
    routeId: input.route.routeId,
    providerId: input.route.providerId,
    capabilityId: input.route.capabilityId,
    goalHash: input.goal ? shortHash(input.goal) : null,
    inputFingerprint: inputFingerprint(input.routeInput),
    fundingModel: input.route.funding.model,
    providerFeeUsd: input.route.funding.feeUsd,
    providerSettlementEndpoint: input.route.funding.settlementEndpoint,
    externalConversionVerified: false,
    callerSpendingAuthorized: false
  };
}

export function logAttributedSettlement(
  response: Response,
  capabilityId: string,
  attributionId: string | null
) {
  if (!attributionId) return;
  const hasPaymentResponse = Boolean(response.headers.get("payment-response"));
  console.log(JSON.stringify({
    event: "attributed_paid_response",
    at: new Date().toISOString(),
    attributionId,
    capabilityId,
    responseStatus: response.status,
    paymentResponsePresent: hasPaymentResponse,
    settledResponse: response.status >= 200 && response.status < 300 && hasPaymentResponse
  }));
}
