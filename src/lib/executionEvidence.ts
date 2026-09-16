import { createHash, randomUUID } from "node:crypto";

export const EXECUTION_EVIDENCE_VERSION = 1;
export const EXECUTION_EVIDENCE_URL =
  "https://agentresolver.vercel.app/.well-known/agentresolver-evidence.json";
export const VERIFIED_SETTLEMENT_HISTORY_URL =
  "https://agentresolver.vercel.app/.well-known/agentresolver-reputation.json";

export type ExecutionEvidence = ReturnType<typeof buildExecutionEvidence>;

export function sha256Utf8(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function buildExecutionEvidence(
  responseBody: string,
  capabilityId: string,
  executionId = randomUUID(),
  completedAt = new Date().toISOString(),
  deploymentCommitSha = process.env.VERCEL_GIT_COMMIT_SHA || null
) {
  return {
    schemaVersion: EXECUTION_EVIDENCE_VERSION,
    executionId,
    completedAt,
    capabilityId,
    responseSha256: sha256Utf8(responseBody),
    digestAlgorithm: "sha256" as const,
    deploymentCommitSha,
    evidenceUrl: EXECUTION_EVIDENCE_URL
  };
}

export function executionEvidenceHeaders(evidence: ExecutionEvidence) {
  return {
    "x-agentresolver-execution-id": evidence.executionId,
    "x-agentresolver-response-sha256": evidence.responseSha256,
    "x-agentresolver-evidence-version": String(evidence.schemaVersion),
    "x-agentresolver-evidence": evidence.evidenceUrl,
    "x-agentresolver-history": VERIFIED_SETTLEMENT_HISTORY_URL
  };
}
