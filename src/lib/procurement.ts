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
  semanticMatch: {
    goalTokens: string[];
    matchedTokens: string[];
    minimumMatches: number;
    coverage: number;
    proven: boolean;
  } | null;
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

const SEMANTIC_STOP_WORDS = new Set([
  "a", "an", "and", "api", "agent", "agents", "capability", "for", "from",
  "in", "into", "mcp", "need", "needs", "of", "on", "over", "service",
  "services", "support", "supports", "that", "the", "this", "to", "tool",
  "tools", "use", "using", "with"
]);

function normalizeSemanticToken(token: string) {
  let normalized = token.toLowerCase();
  if (normalized.endsWith("ies") && normalized.length > 4) {
    normalized = `${normalized.slice(0, -3)}y`;
  } else if (normalized.endsWith("ing") && normalized.length > 5) {
    normalized = normalized.slice(0, -3);
  } else if (normalized.endsWith("ed") && normalized.length > 4) {
    normalized = normalized.slice(0, -2);
  } else if (normalized.endsWith("es") && normalized.length > 4) {
    normalized = normalized.slice(0, -2);
  } else if (normalized.endsWith("s") && normalized.length > 3) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function semanticTokens(value: string) {
  return [
    ...new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .map(normalizeSemanticToken)
        .filter(
          (token) =>
            token.length > 2 &&
            !SEMANTIC_STOP_WORDS.has(token)
        )
    )
  ];
}

function semanticEvidence(
  goal: string,
  candidate: ProcurementCandidate
) {
  const goalTokens = semanticTokens(goal);
  if (goalTokens.length === 0) return null;

  const evidenceText = [
    candidate.name,
    candidate.description || "",
    candidate.evidence ? JSON.stringify(candidate.evidence) : ""
  ].join(" ");
  const evidenceTokens = new Set(semanticTokens(evidenceText));
  const matchedTokens = goalTokens.filter((token) => evidenceTokens.has(token));
  const minimumMatches =
    goalTokens.length <= 2
      ? 1
      : Math.max(2, Math.ceil(goalTokens.length * 0.35));

  return {
    goalTokens,
    matchedTokens,
    minimumMatches,
    coverage: matchedTokens.length / goalTokens.length,
    proven: matchedTokens.length >= minimumMatches
  };
}

export function evaluateProcurementCandidate(
  candidate: ProcurementCandidate,
  constraints: ProcurementConstraints,
  goal = ""
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

  const semanticMatch = semanticEvidence(goal, candidate);
  if (semanticMatch && !semanticMatch.proven) {
    unknownConstraints.push("semantic_capability");
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
    },
    semanticMatch
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
  limit = 5,
  goal = ""
): ProcurementEvaluation[] {
  const safeLimit = Math.max(1, Math.min(limit, 20));

  return candidates
    .map((candidate) => evaluateProcurementCandidate(candidate, constraints, goal))
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
