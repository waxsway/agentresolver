import { evaluateToolContract } from "@/lib/toolContract";

export type JsonSchema = Record<string, unknown>;

export type ProcurementProtocol = "x402" | "l402" | "mpp" | "mcp" | "http";

export type ProcurementConstraints = {
  maxPriceUsd?: number;
  preferredNetworks?: string[];
  protocol?: "x402" | "l402" | "mpp" | "mcp" | "any";
  requireHttps?: boolean;
  availableInputSchema?: JsonSchema;
  requiredOutputSchema?: JsonSchema;
  sideEffect?: "read-only" | "state-changing" | "any";
  auth?: "none" | "wallet" | "api-key" | "any";
};

export type ProcurementCandidate = {
  id: string;
  source: string;
  sourceRank: number;
  name: string;
  description: string | null;
  endpoint: string | null;
  protocol: ProcurementProtocol;
  priceUsd: number | null;
  networks: string[];
  inputSchema?: JsonSchema | null;
  outputSchema?: JsonSchema | null;
  sideEffect?: "read-only" | "state-changing" | "unknown";
  auth?: "none" | "wallet" | "api-key" | "unknown";
  execute: Record<string, unknown> | null;
  evidence?: Record<string, unknown> | null;
};

export type ProcurementEvaluation = ProcurementCandidate & {
  status: "eligible" | "eligible_with_unknowns" | "rejected";
  rejectionReasons: string[];
  unknownConstraints: string[];
  contractChecks: {
    input: ReturnType<typeof evaluateToolContract> | null;
    output: ReturnType<typeof evaluateToolContract> | null;
  };
};

function normalizedNetworks(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function intersection(a: string[], b: string[]) {
  const wanted = new Set(b);
  return a.some((value) => wanted.has(value));
}

function isHttps(value: string | null) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function evaluateProcurementCandidate(
  candidate: ProcurementCandidate,
  constraints: ProcurementConstraints
): ProcurementEvaluation {
  const rejectionReasons: string[] = [];
  const unknownConstraints: string[] = [];
  const preferredNetworks = normalizedNetworks(constraints.preferredNetworks);

  if (
    typeof constraints.maxPriceUsd === "number" &&
    candidate.priceUsd !== null &&
    candidate.priceUsd > constraints.maxPriceUsd
  ) {
    rejectionReasons.push(
      `price_exceeds_budget:${candidate.priceUsd}>${constraints.maxPriceUsd}`
    );
  } else if (
    typeof constraints.maxPriceUsd === "number" &&
    candidate.priceUsd === null &&
    candidate.protocol !== "http" &&
    candidate.protocol !== "mcp"
  ) {
    unknownConstraints.push("price");
  }

  if (
    constraints.protocol &&
    constraints.protocol !== "any" &&
    candidate.protocol !== constraints.protocol
  ) {
    rejectionReasons.push(
      `protocol_mismatch:${candidate.protocol}!=${constraints.protocol}`
    );
  }

  if (
    preferredNetworks.length > 0 &&
    candidate.protocol !== "http" &&
    candidate.protocol !== "mcp"
  ) {
    if (candidate.networks.length === 0) {
      unknownConstraints.push("network");
    } else if (!intersection(candidate.networks, preferredNetworks)) {
      rejectionReasons.push("network_mismatch");
    }
  }

  if (constraints.requireHttps !== false) {
    if (!candidate.endpoint) unknownConstraints.push("https_endpoint");
    else if (!isHttps(candidate.endpoint)) rejectionReasons.push("https_required");
  }

  let inputCheck: ReturnType<typeof evaluateToolContract> | null = null;
  if (constraints.availableInputSchema) {
    if (candidate.inputSchema) {
      inputCheck = evaluateToolContract(
        constraints.availableInputSchema,
        candidate.inputSchema
      );
      if (inputCheck.verdict === "incompatible") {
        rejectionReasons.push("input_contract_incompatible");
      }
    } else {
      unknownConstraints.push("input_contract");
    }
  }

  let outputCheck: ReturnType<typeof evaluateToolContract> | null = null;
  if (constraints.requiredOutputSchema) {
    if (candidate.outputSchema) {
      outputCheck = evaluateToolContract(
        candidate.outputSchema,
        constraints.requiredOutputSchema
      );
      if (outputCheck.verdict === "incompatible") {
        rejectionReasons.push("output_contract_incompatible");
      }
    } else {
      unknownConstraints.push("output_contract");
    }
  }

  if (constraints.sideEffect && constraints.sideEffect !== "any") {
    if (!candidate.sideEffect || candidate.sideEffect === "unknown") {
      unknownConstraints.push("side_effect");
    } else if (candidate.sideEffect !== constraints.sideEffect) {
      rejectionReasons.push(
        `side_effect_mismatch:${candidate.sideEffect}!=${constraints.sideEffect}`
      );
    }
  }

  if (constraints.auth && constraints.auth !== "any") {
    if (!candidate.auth || candidate.auth === "unknown") {
      unknownConstraints.push("auth");
    } else if (candidate.auth !== constraints.auth) {
      rejectionReasons.push(
        `auth_mismatch:${candidate.auth}!=${constraints.auth}`
      );
    }
  }

  const dedupedUnknowns = [...new Set(unknownConstraints)];
  const status: ProcurementEvaluation["status"] =
    rejectionReasons.length > 0
      ? "rejected"
      : dedupedUnknowns.length > 0
        ? "eligible_with_unknowns"
        : "eligible";

  return {
    ...candidate,
    status,
    rejectionReasons,
    unknownConstraints: dedupedUnknowns,
    contractChecks: {
      input: inputCheck,
      output: outputCheck
    }
  };
}

const STATUS_ORDER: Record<ProcurementEvaluation["status"], number> = {
  eligible: 0,
  eligible_with_unknowns: 1,
  rejected: 2
};

export function rankProcurementCandidates(
  candidates: ProcurementCandidate[],
  constraints: ProcurementConstraints,
  limit = 5
): ProcurementEvaluation[] {
  const safeLimit = Math.max(1, Math.min(limit, 20));

  return candidates
    .map((candidate) => evaluateProcurementCandidate(candidate, constraints))
    .sort((a, b) => {
      const statusDelta = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDelta !== 0) return statusDelta;

      const unknownDelta =
        a.unknownConstraints.length - b.unknownConstraints.length;
      if (unknownDelta !== 0) return unknownDelta;

      const rankDelta = a.sourceRank - b.sourceRank;
      if (rankDelta !== 0) return rankDelta;

      return (
        (a.priceUsd ?? Number.POSITIVE_INFINITY) -
        (b.priceUsd ?? Number.POSITIVE_INFINITY)
      );
    })
    .slice(0, safeLimit);
}
