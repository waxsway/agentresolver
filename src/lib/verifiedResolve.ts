import { resolveGoal } from "@/lib/resolver";
import { probeMcpEndpoint } from "@/lib/mcpProbe";

const MAX_PROBES = 2;

export async function verifiedResolve(goal: string, url?: string) {
  const resolution = await resolveGoal(goal, url, 5);
  const probeTargets = resolution.mcp
    .filter((item) => Boolean(item.endpoint))
    .slice(0, MAX_PROBES);

  const probes = await Promise.all(
    probeTargets.map(async (item) => {
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
  );

  const verifiedMcp = probes
    .filter((item) => item.mcpCompatible)
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
      maxLiveMcpProbes: MAX_PROBES,
      callerSpendingAuthorized: false,
      note:
        "This operation verifies a bounded set of top MCP candidates. Returned candidates still require the caller's own trust, privacy, and permission checks before use."
    },
    owned: resolution.owned,
    marketplace: resolution.marketplace,
    mcp: resolution.mcp,
    liveVerification: probes,
    recommendation:
      verifiedMcp.length > 0
        ? {
            type: "verified-mcp",
            endpoint: verifiedMcp[0].endpoint,
            name: verifiedMcp[0].name,
            reason:
              "Top discovered MCP candidate completed a live initialize + tools/list verification."
          }
        : resolution.owned.length > 0
          ? {
              type: "owned-capability",
              capability: resolution.owned[0],
              reason:
                "No probed MCP candidate completed verification; highest-ranked AgentResolver-owned capability is shown."
            }
          : {
              type: "discovery-only",
              reason:
                "No candidate completed live MCP verification. Review the returned directory and marketplace candidates."
            }
  };
}
