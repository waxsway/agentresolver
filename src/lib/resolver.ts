import { resolveCapabilities } from "@/lib/catalog";
import {
  discoverCircleResources,
  type MarketplaceMatch
} from "@/lib/circleDiscovery";
import {
  discoverMcpServers,
  type McpDirectoryMatch
} from "@/lib/mcpDiscovery";

export type Resolution = {
  owned: ReturnType<typeof resolveCapabilities>;
  mcp: McpDirectoryMatch[];
  marketplace: MarketplaceMatch[];
};

export async function resolveGoal(
  goal: string,
  url?: string,
  limit = 3
): Promise<Resolution> {
  const safeLimit = Math.max(1, Math.min(limit, 10));

  const [mcp, marketplace] = await Promise.all([
    discoverMcpServers(goal, safeLimit),
    discoverCircleResources(goal, safeLimit)
  ]);

  return {
    owned: resolveCapabilities(
      `${goal}${url ? ` ${url}` : ""}`,
      safeLimit + 1
    ).filter((match) => match.id !== "resolve").slice(0, safeLimit),
    mcp,
    marketplace
  };
}
