import { resolveGoal } from "@/lib/resolver";
import { probeMcpEndpoint } from "@/lib/mcpProbe";
import { probeMarketplaceResource } from "@/lib/x402HttpProbe";

const MAX_LIVE_PROBES = 2;

export async function verifiedResolve(goal: string, url?: string) {
  const resolution = await resolveGoal(goal, url, 5);
  const mcpCandidates = resolution.mcp.filter((item) => Boolean(item.endpoint));
  const marketplaceCandidates = resolution.marketplace.filter((item) => Boolean(item.resource));

  const hasMcp = mcpCandidates.length > 0;
  const hasMarketplace = marketplaceCandidates.length > 0;
  const mcpSlots = hasMcp && hasMarketplace
    ? 1
    : hasMcp
      ? MAX_LIVE_PROBES
      : 0;
  const marketplaceSlots = hasMcp && hasMarketplace
    ? 1
    : hasMarketplace
      ? MAX_LIVE_PROBES
      : 0;

  const [mcpProbes, marketplaceProbes] = await Promise.all([
    Promise.all(
      mcpCandidates.slice(0, mcpSlots).map(async (item) => {
        try {
          const report = await probeMcpEndpoint(item.endpoint as string);
          return {
            name: item.name || item.title || item.endpoint,
            endpoint: item.endpoint,
            source: item.source,
            reachable: report.reachable,
            mcpCompatible: report.mcpCompatible,
            latencyMs: report.initialize.latencyMs,
            toolCount: report.tools.count,
            toolNames: report.tools.names.slice(0, 20),
            serverName: report.initialize.serverName,
            serverVersion: report.initialize.serverVersion,
            confidence: report.mcpCompatible ? 1 : report.reachable ? 0.5 : 0
          };
        } catch (error) {
          return {
            name: item.name || item.title || item.endpoint,
            endpoint: item.endpoint,
            source: item.source,
            reachable: false,
            mcpCompatible: false,
            latencyMs: null,
            toolCount: null,
            toolNames: [],
            serverName: null,
            serverVersion: null,
            confidence: 0,
            error: error instanceof Error ? error.message : "Probe failed"
          };
        }
      })
    ),
    Promise.all(
      marketplaceCandidates
        .slice(0, marketplaceSlots)
        .map((item) => probeMarketplaceResource(item))
    )
  ]);

  const verifiedMcp = mcpProbes
    .filter((item) => item.mcpCompatible)
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        (a.latencyMs ?? Number.POSITIVE_INFINITY) -
          (b.latencyMs ?? Number.POSITIVE_INFINITY)
    );

  const verifiedMarketplace = marketplaceProbes
    .filter((item) => item.x402Compatible)
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        (a.latencyMs ?? Number.POSITIVE_INFINITY) -
          (b.latencyMs ?? Number.POSITIVE_INFINITY)
    );

  return {
    goal,
    targetUrl: url || null,
    generatedAt: new Date().toISOString(),
    verificationPolicy: {
      maxLiveProbes: MAX_LIVE_PROBES,
      maxLiveMcpProbes: mcpSlots,
      maxLiveMarketplaceProbes: marketplaceSlots,
      callerSpendingAuthorized: false,
      note:
        "This operation performs at most two unpaid live probes across top MCP and x402/HTTP marketplace candidates. It never authorizes or submits payment. Returned candidates still require the caller's own trust, privacy, budget, and permission checks before use."
    },
    owned: resolution.owned,
    marketplace: resolution.marketplace,
    mcp: resolution.mcp,
    liveVerification: mcpProbes,
    liveMarketplaceVerification: marketplaceProbes,
    recommendation:
      verifiedMcp.length > 0
        ? {
            type: "verified-mcp",
            endpoint: verifiedMcp[0].endpoint,
            name: verifiedMcp[0].name,
            reason:
              "Top discovered MCP candidate completed a live initialize + tools/list verification."
          }
        : verifiedMarketplace.length > 0
          ? {
              type: "verified-x402-http",
              resource: verifiedMarketplace[0].resource,
              provider: verifiedMarketplace[0].provider,
              method: verifiedMarketplace[0].method,
              paymentOptions: verifiedMarketplace[0].paymentOptions,
              reason:
                "Top marketplace candidate responded live with a parseable x402 payment challenge. No payment was sent."
            }
          : resolution.owned.length > 0
            ? {
                type: "owned-capability",
                capability: resolution.owned[0],
                reason:
                  "No probed external candidate completed verification; highest-ranked AgentResolver-owned capability is shown."
              }
            : {
                type: "discovery-only",
                reason:
                  "No candidate completed live MCP or x402/HTTP verification. Review the returned directory and marketplace candidates."
              }
  };
}
