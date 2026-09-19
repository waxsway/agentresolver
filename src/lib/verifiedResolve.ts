import { CANONICAL_ORIGIN } from "@/lib/paidCapabilities";
import {
  procureCapability,
  type ProcurementResult
} from "@/lib/procureCapability";
import {
  evaluateProcurementSemanticEvidence,
  type ProcurementConstraints,
  type ProcurementEvaluation
} from "@/lib/procurement";
import { evaluateToolContract } from "@/lib/toolContract";
import {
  probeMcpEndpoint,
  type McpToolEvidence
} from "@/lib/mcpProbe";
import {
  probeX402Resource,
  type MarketplaceProbeReport
} from "@/lib/x402HttpProbe";

const MAX_LIVE_PROBES = 2;

type McpVerification = {
  candidateId: string;
  protocol: "mcp";
  name: string;
  endpoint: string;
  source: string;
  reachable: boolean;
  mcpCompatible: boolean;
  latencyMs: number | null;
  toolCount: number | null;
  toolNames: string[];
  toolEvidence: McpToolEvidence[];
  semanticMatch: ReturnType<typeof evaluateProcurementSemanticEvidence>;
  resolvedUnknownConstraints: string[];
  remainingUnknownConstraints: string[];
  contractProven: boolean;
  serverName: string | null;
  serverVersion: string | null;
  confidence: number;
  error?: string;
};

type X402Verification = MarketplaceProbeReport & {
  candidateId: string;
  protocol: "x402";
  expectedPriceUsd: number | null;
  expectedNetworks: string[];
  contractMatchesCatalog: boolean;
  resolvedUnknownConstraints: string[];
  remainingUnknownConstraints: string[];
  contractProven: boolean;
};

type UnsupportedVerification = {
  candidateId: string;
  protocol: "l402" | "mpp";
  name: string;
  endpoint: string;
  source: string;
  verified: false;
  reason: "protocol_specific_live_verifier_not_available";
};

function candidateMethod(candidate: ProcurementEvaluation) {
  const execute =
    candidate.execute &&
    typeof candidate.execute === "object" &&
    !Array.isArray(candidate.execute)
      ? (candidate.execute as Record<string, unknown>)
      : null;
  const value = execute?.method;
  return typeof value === "string" ? value.toUpperCase() : null;
}

function candidateProvider(candidate: ProcurementEvaluation) {
  const evidence =
    candidate.evidence &&
    typeof candidate.evidence === "object" &&
    !Array.isArray(candidate.evidence)
      ? (candidate.evidence as Record<string, unknown>)
      : null;
  const enrollment =
    evidence?.domainProviderEnrollment &&
    typeof evidence.domainProviderEnrollment === "object" &&
    !Array.isArray(evidence.domainProviderEnrollment)
      ? (evidence.domainProviderEnrollment as Record<string, unknown>)
      : null;
  return typeof enrollment?.providerName === "string"
    ? enrollment.providerName
    : candidate.name;
}

function x402ContractMatches(
  candidate: ProcurementEvaluation,
  report: MarketplaceProbeReport
) {
  if (!report.x402Compatible) return false;
  if (report.paymentOptions.length === 0) return false;

  const expectedAtomic =
    candidate.priceUsd === null
      ? null
      : String(Math.round(candidate.priceUsd * 1_000_000));

  const execute =
    candidate.execute &&
    typeof candidate.execute === "object" &&
    !Array.isArray(candidate.execute)
      ? (candidate.execute as Record<string, unknown>)
      : null;
  const identity =
    execute?.paymentIdentity &&
    typeof execute.paymentIdentity === "object" &&
    !Array.isArray(execute.paymentIdentity)
      ? (execute.paymentIdentity as Record<string, unknown>)
      : null;

  return report.paymentOptions.some((option) => {
    const expectedNetwork =
      typeof identity?.network === "string"
        ? identity.network
        : candidate.networks.length > 0
          ? null
          : undefined;
    const networkMatches =
      expectedNetwork === undefined
        ? true
        : expectedNetwork === null
          ? candidate.networks.includes(option.network || "")
          : option.network === expectedNetwork;

    const identityAmount =
      typeof identity?.amountAtomic === "string"
        ? identity.amountAtomic
        : null;
    const amountMatches =
      identityAmount !== null
        ? option.amount === identityAmount
        : expectedAtomic === null
          ? true
          : option.amount === expectedAtomic;

    const expectedPayTo =
      typeof identity?.payTo === "string" ? identity.payTo.toLowerCase() : null;
    const payToMatches =
      expectedPayTo === null
        ? true
        : option.payTo?.toLowerCase() === expectedPayTo;

    const expectedAsset =
      typeof identity?.asset === "string" ? identity.asset.toLowerCase() : null;
    const assetMatches =
      expectedAsset === null
        ? true
        : option.asset?.toLowerCase() === expectedAsset;

    return networkMatches && amountMatches && payToMatches && assetMatches;
  });
}

function probePriority(
  procurement: ProcurementResult
): ProcurementEvaluation[] {
  const selectedId = procurement.selected?.id;
  return [...procurement.candidates]
    .filter(
      (candidate) =>
        candidate.status !== "rejected" &&
        Boolean(candidate.endpoint) &&
        (candidate.protocol === "mcp" || candidate.protocol === "x402")
    )
    .sort((a, b) => {
      if (a.id === selectedId && b.id !== selectedId) return -1;
      if (b.id === selectedId && a.id !== selectedId) return 1;
      return a.sourceRank - b.sourceRank;
    })
    .slice(0, MAX_LIVE_PROBES);
}

function liveToolMatchesContracts(
  tool: McpToolEvidence,
  constraints: ProcurementConstraints
) {
  const inputMatches =
    !constraints.availableInputSchema ||
    (tool.inputSchema !== null &&
      evaluateToolContract(
        constraints.availableInputSchema,
        tool.inputSchema
      ).verdict !== "incompatible");

  const outputMatches =
    !constraints.requiredOutputSchema ||
    (tool.outputSchema !== null &&
      evaluateToolContract(
        tool.outputSchema,
        constraints.requiredOutputSchema
      ).verdict !== "incompatible");

  const sideEffectMatches =
    !constraints.sideEffect ||
    constraints.sideEffect === "any" ||
    (constraints.sideEffect === "read-only" &&
      tool.annotations?.readOnlyHint === true) ||
    (constraints.sideEffect === "state-changing" &&
      tool.annotations?.readOnlyHint === false);

  return { inputMatches, outputMatches, sideEffectMatches };
}

async function verifyMcpCandidate(
  candidate: ProcurementEvaluation,
  goal: string,
  constraints: ProcurementConstraints
): Promise<McpVerification> {
  const endpoint = candidate.endpoint as string;
  try {
    const report = await probeMcpEndpoint(endpoint);
    const toolEvidence = report.tools.items.slice(0, 20);
    const liveEvidenceText = toolEvidence
      .map((tool) => `${tool.name} ${tool.description || ""}`)
      .join(" ");
    const semanticMatch = evaluateProcurementSemanticEvidence(
      goal,
      candidate,
      liveEvidenceText
    );

    const remaining = new Set(candidate.unknownConstraints);
    const resolved: string[] = [];

    if (semanticMatch?.proven && remaining.delete("semantic_capability")) {
      resolved.push("semantic_capability");
    }

    const matchingTools = toolEvidence.filter((tool) => {
      const checks = liveToolMatchesContracts(tool, constraints);
      return checks.inputMatches && checks.outputMatches && checks.sideEffectMatches;
    });

    if (
      constraints.availableInputSchema &&
      matchingTools.some((tool) => tool.inputSchema !== null) &&
      remaining.delete("input_contract")
    ) {
      resolved.push("input_contract");
    }
    if (
      constraints.requiredOutputSchema &&
      matchingTools.some((tool) => tool.outputSchema !== null) &&
      remaining.delete("output_contract")
    ) {
      resolved.push("output_contract");
    }
    if (
      constraints.sideEffect &&
      constraints.sideEffect !== "any" &&
      matchingTools.some((tool) => tool.annotations?.readOnlyHint !== undefined) &&
      remaining.delete("side_effect")
    ) {
      resolved.push("side_effect");
    }

    const remainingUnknownConstraints = [...remaining];
    const contractProven =
      report.mcpCompatible &&
      Boolean(semanticMatch?.proven ?? true) &&
      remainingUnknownConstraints.length === 0;

    return {
      candidateId: candidate.id,
      protocol: "mcp",
      name: candidate.name,
      endpoint,
      source: candidate.source,
      reachable: report.reachable,
      mcpCompatible: report.mcpCompatible,
      latencyMs: report.initialize.latencyMs,
      toolCount: report.tools.count,
      toolNames: report.tools.names.slice(0, 20),
      toolEvidence,
      semanticMatch,
      resolvedUnknownConstraints: resolved,
      remainingUnknownConstraints,
      contractProven,
      serverName: report.initialize.serverName,
      serverVersion: report.initialize.serverVersion,
      confidence: contractProven ? 1 : report.mcpCompatible ? 0.6 : report.reachable ? 0.3 : 0
    };
  } catch (error) {
    return {
      candidateId: candidate.id,
      protocol: "mcp",
      name: candidate.name,
      endpoint,
      source: candidate.source,
      reachable: false,
      mcpCompatible: false,
      latencyMs: null,
      toolCount: null,
      toolNames: [],
      toolEvidence: [],
      semanticMatch: candidate.semanticMatch,
      resolvedUnknownConstraints: [],
      remainingUnknownConstraints: [...candidate.unknownConstraints],
      contractProven: false,
      serverName: null,
      serverVersion: null,
      confidence: 0,
      error: error instanceof Error ? error.message : "Probe failed"
    };
  }
}

async function verifyX402Candidate(
  candidate: ProcurementEvaluation
): Promise<X402Verification> {
  const report = await probeX402Resource({
    provider: candidateProvider(candidate),
    resource: candidate.endpoint as string,
    source: candidate.source,
    method: candidateMethod(candidate)
  });

  const contractMatchesCatalog = x402ContractMatches(candidate, report);
  const remaining = new Set(candidate.unknownConstraints);
  const resolved: string[] = [];

  if (
    report.x402Compatible &&
    report.paymentOptions.some((option) => Boolean(option.amount)) &&
    remaining.delete("price")
  ) {
    resolved.push("price");
  }

  if (
    report.x402Compatible &&
    report.paymentOptions.some((option) => Boolean(option.network)) &&
    remaining.delete("network")
  ) {
    resolved.push("network");
  }

  const remainingUnknownConstraints = [...remaining];
  const contractProven =
    report.x402Compatible &&
    contractMatchesCatalog &&
    remainingUnknownConstraints.length === 0 &&
    Boolean(candidate.semanticMatch?.proven ?? true);

  return {
    ...report,
    candidateId: candidate.id,
    protocol: "x402",
    expectedPriceUsd: candidate.priceUsd,
    expectedNetworks: candidate.networks,
    contractMatchesCatalog,
    resolvedUnknownConstraints: resolved,
    remainingUnknownConstraints,
    contractProven
  };
}

export async function verifiedResolve(
  goal: string,
  options: {
    url?: string;
    constraints?: ProcurementConstraints;
    providerOrigins?: string[];
    baseUrl?: string;
  } = {}
) {
  const constraints: ProcurementConstraints = {
    requireHttps: true,
    ...(options.constraints || {})
  };
  const procurementGoal = options.url
    ? `${goal} ${options.url}`
    : goal;

  const procurement = await procureCapability(
    procurementGoal,
    constraints,
    5,
    options.baseUrl || CANONICAL_ORIGIN,
    { providerOrigins: options.providerOrigins }
  );

  const toProbe = probePriority(procurement);
  const live = await Promise.all(
    toProbe.map((candidate) =>
      candidate.protocol === "mcp"
        ? verifyMcpCandidate(candidate, procurementGoal, constraints)
        : verifyX402Candidate(candidate)
    )
  );

  const liveMcpVerification = live.filter(
    (item): item is McpVerification => item.protocol === "mcp"
  );
  const liveMarketplaceVerification = live.filter(
    (item): item is X402Verification => item.protocol === "x402"
  );

  const unsupportedProtocolCandidates: UnsupportedVerification[] =
    procurement.candidates
      .filter(
        (candidate) =>
          candidate.status !== "rejected" &&
          Boolean(candidate.endpoint) &&
          (candidate.protocol === "l402" || candidate.protocol === "mpp")
      )
      .slice(0, MAX_LIVE_PROBES)
      .map((candidate) => ({
        candidateId: candidate.id,
        protocol: candidate.protocol as "l402" | "mpp",
        name: candidate.name,
        endpoint: candidate.endpoint as string,
        source: candidate.source,
        verified: false,
        reason: "protocol_specific_live_verifier_not_available" as const
      }));

  const selectedId = procurement.selected?.id;
  const selectedLive = live.find((item) => item.candidateId === selectedId);
  const verifiedX402 = liveMarketplaceVerification.find(
    (item) => item.contractProven
  );
  const unprovenLiveX402 = liveMarketplaceVerification.find(
    (item) =>
      item.x402Compatible &&
      item.contractMatchesCatalog &&
      !item.contractProven
  );
  const verifiedMcp = liveMcpVerification.find((item) => item.contractProven);
  const unprovenLiveMcp = liveMcpVerification.find(
    (item) => item.mcpCompatible && !item.contractProven
  );

  const recommendation = selectedLive
    ? selectedLive.protocol === "x402"
      ? selectedLive.contractProven
        ? {
            type: "verified-x402-procurement" as const,
            candidateId: selectedLive.candidateId,
            endpoint: selectedLive.resource,
            paymentOptions: selectedLive.paymentOptions,
            reason:
              "The selected procurement candidate responded live with a parseable x402 challenge matching the payment contract, and no requested contract properties remain unknown. No target payment was sent."
          }
        : selectedLive.x402Compatible && selectedLive.contractMatchesCatalog
          ? {
              type: "x402-live-contract-unproven" as const,
              candidateId: selectedLive.candidateId,
              endpoint: selectedLive.resource,
              paymentOptions: selectedLive.paymentOptions,
              remainingUnknownConstraints:
                selectedLive.remainingUnknownConstraints,
              reason:
                "The x402 payment contract is live and consistent, but payment evidence cannot prove every requested capability property."
            }
          : {
              type: "selected-candidate-verification-failed" as const,
              candidateId: selectedLive.candidateId,
              endpoint: selectedLive.resource,
              reason:
                "The selected x402 candidate did not produce a live payment challenge matching its procurement contract."
            }
      : selectedLive.contractProven
        ? {
            type: "verified-mcp-procurement" as const,
            candidateId: selectedLive.candidateId,
            endpoint: selectedLive.endpoint,
            reason:
              "The selected MCP candidate completed live protocol verification and the live tool metadata proved the requested contract."
          }
        : selectedLive.mcpCompatible
          ? {
              type: "mcp-live-contract-unproven" as const,
              candidateId: selectedLive.candidateId,
              endpoint: selectedLive.endpoint,
              remainingUnknownConstraints: selectedLive.remainingUnknownConstraints,
              reason:
                "The MCP endpoint is live, but its tool metadata does not prove every requested contract property."
            }
          : {
              type: "selected-candidate-verification-failed" as const,
              candidateId: selectedLive.candidateId,
              endpoint: selectedLive.endpoint,
              reason:
                "The selected MCP candidate did not complete live protocol verification."
            }
    : procurement.selected?.protocol === "l402" ||
        procurement.selected?.protocol === "mpp"
      ? {
          type: "selected-protocol-not-live-verifiable" as const,
          candidateId: procurement.selected.id,
          endpoint: procurement.selected.endpoint,
          protocol: procurement.selected.protocol,
          reason:
            "AgentResolver discovered and ranked this candidate but does not yet claim protocol-specific live verification for this payment rail."
        }
      : verifiedX402
        ? {
            type: "verified-x402-procurement" as const,
            candidateId: verifiedX402.candidateId,
            endpoint: verifiedX402.resource,
            paymentOptions: verifiedX402.paymentOptions,
            reason:
              "A top procured x402 candidate responded live with a payment challenge matching its catalog contract. No target payment was sent."
          }
        : unprovenLiveX402
          ? {
              type: "x402-live-contract-unproven" as const,
              candidateId: unprovenLiveX402.candidateId,
              endpoint: unprovenLiveX402.resource,
              paymentOptions: unprovenLiveX402.paymentOptions,
              remainingUnknownConstraints:
                unprovenLiveX402.remainingUnknownConstraints,
              reason:
                "A top x402 candidate exposed a valid live payment contract, but payment evidence cannot prove every requested capability property."
            }
          : verifiedMcp
          ? {
              type: "verified-mcp-procurement" as const,
              candidateId: verifiedMcp.candidateId,
              endpoint: verifiedMcp.endpoint,
              reason:
                "A top procured MCP candidate completed live protocol verification and its live tool metadata proved the requested contract."
            }
          : unprovenLiveMcp
            ? {
                type: "mcp-live-contract-unproven" as const,
                candidateId: unprovenLiveMcp.candidateId,
                endpoint: unprovenLiveMcp.endpoint,
                remainingUnknownConstraints:
                  unprovenLiveMcp.remainingUnknownConstraints,
                reason:
                  "A top MCP candidate is live, but its tool metadata does not prove every requested contract property."
              }
            : procurement.selected
            ? {
                type: "procurement-only" as const,
                candidateId: procurement.selected.id,
                endpoint: procurement.selected.endpoint,
                reason:
                  "Procurement produced a candidate, but no supported live verifier completed successfully."
              }
            : {
                type: "no-compatible-candidate" as const,
                reason:
                  "No procurement candidate survived the requested hard constraints."
              };

  return {
    goal,
    targetUrl: options.url || null,
    generatedAt: new Date().toISOString(),
    constraints,
    providerOrigins: options.providerOrigins || [],
    procurement,
    verificationPolicy: {
      maxLiveProbes: MAX_LIVE_PROBES,
      protocolsLiveVerified: ["mcp", "x402"],
      protocolsDiscoveryOnly: ["l402", "mpp"],
      callerSpendingAuthorized: false,
      targetPaymentSubmitted: false,
      note:
        "This operation performs at most two unpaid live probes against top procurement candidates. MCP verification retains bounded live tool names, descriptions, schemas, and annotations. x402 verification observes payment mechanics only. Neither protocol upgrades a candidate unless every requested contract unknown is actually resolved by available evidence. It never authorizes or submits a target payment. L402 and MPP candidates remain discovery/ranking-only until protocol-specific live verifiers are implemented."
    },
    liveVerification: live,
    liveMcpVerification,
    liveMarketplaceVerification,
    unsupportedProtocolCandidates,
    recommendation
  };
}
