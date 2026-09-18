import { shortHash } from "@/lib/telemetry";
import { isAttributionId } from "@/lib/transactionAttribution";

export type ProviderSettlementInput = {
  attributionId: string;
  providerId: string;
  outcome: "fulfilled" | "qualified-lead";
  externalTransactionRefHash: string | null;
};

export function parseProviderSettlementInput(value: unknown): ProviderSettlementInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Provide a JSON object.");
  }
  const body = value as Record<string, unknown>;
  const attributionId = typeof body.attributionId === "string" ? body.attributionId.trim() : "";
  const providerId = typeof body.providerId === "string" ? body.providerId.trim() : "";
  const outcome = body.outcome === "qualified-lead" ? "qualified-lead" : body.outcome === "fulfilled" ? "fulfilled" : null;
  const externalTransactionRef =
    typeof body.externalTransactionRef === "string" ? body.externalTransactionRef.trim() : "";

  if (!isAttributionId(attributionId)) throw new Error("attributionId must be a valid AgentResolver attribution ID.");
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(providerId)) {
    throw new Error("providerId is invalid.");
  }
  if (!outcome) throw new Error("outcome must be fulfilled or qualified-lead.");
  if (externalTransactionRef.length > 256) throw new Error("externalTransactionRef is too long.");

  return {
    attributionId,
    providerId,
    outcome,
    externalTransactionRefHash: externalTransactionRef ? shortHash(externalTransactionRef) : null
  };
}
