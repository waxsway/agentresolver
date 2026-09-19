import { shortHash } from "@/lib/telemetry";
import { isAttributionId } from "@/lib/transactionAttribution";

export type ProviderSettlementInput =
  | {
      attributionId: string;
      providerId: string;
      routeId: string;
      outcome: "fulfilled";
      buyerTxHash: string;
      externalTransactionRefHash: string | null;
    }
  | {
      attributionId: string;
      providerId: string;
      routeId: string | null;
      outcome: "qualified-lead";
      buyerTxHash: null;
      externalTransactionRefHash: string | null;
    };

function boundedExternalRef(body: Record<string, unknown>) {
  const value =
    typeof body.externalTransactionRef === "string"
      ? body.externalTransactionRef.trim()
      : "";
  if (value.length > 256) {
    throw new Error("externalTransactionRef is too long.");
  }
  return value ? shortHash(value) : null;
}

export function parseProviderSettlementInput(
  value: unknown
): ProviderSettlementInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Provide a JSON object.");
  }

  const body = value as Record<string, unknown>;
  const attributionId =
    typeof body.attributionId === "string" ? body.attributionId.trim() : "";
  const providerId =
    typeof body.providerId === "string" ? body.providerId.trim() : "";
  const routeId =
    typeof body.routeId === "string" ? body.routeId.trim() : "";
  const outcome =
    body.outcome === "qualified-lead"
      ? "qualified-lead"
      : body.outcome === "fulfilled"
        ? "fulfilled"
        : null;
  const buyerTxHash =
    typeof body.buyerTxHash === "string" ? body.buyerTxHash.trim() : "";

  if (!isAttributionId(attributionId)) {
    throw new Error(
      "attributionId must be a valid AgentResolver attribution ID."
    );
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(providerId)) {
    throw new Error("providerId is invalid.");
  }
  if (!outcome) {
    throw new Error("outcome must be fulfilled or qualified-lead.");
  }

  const externalTransactionRefHash = boundedExternalRef(body);

  if (outcome === "fulfilled") {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(routeId)) {
      throw new Error("routeId is required for fulfilled conversions.");
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(buyerTxHash)) {
      throw new Error(
        "buyerTxHash is required for fulfilled conversions and must be a Base transaction hash."
      );
    }
    return {
      attributionId,
      providerId,
      routeId,
      outcome,
      buyerTxHash,
      externalTransactionRefHash
    };
  }

  return {
    attributionId,
    providerId,
    routeId: routeId || null,
    outcome,
    buyerTxHash: null,
    externalTransactionRefHash
  };
}
