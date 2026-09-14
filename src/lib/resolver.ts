import { resolveCapabilities } from "@/lib/catalog";
import {
  discoverCircleResources,
  type MarketplaceMatch
} from "@/lib/circleDiscovery";

export type Resolution = {
  owned: ReturnType<typeof resolveCapabilities>;
  marketplace: MarketplaceMatch[];
};

export async function resolveGoal(
  goal: string,
  url?: string,
  limit = 3
): Promise<Resolution> {
  const safeLimit = Math.max(1, Math.min(limit, 10));

  const [marketplace] = await Promise.all([
    discoverCircleResources(goal, safeLimit)
  ]);

  return {
    owned: resolveCapabilities(
      `${goal}${url ? ` ${url}` : ""}`,
      safeLimit
    ),
    marketplace
  };
}
