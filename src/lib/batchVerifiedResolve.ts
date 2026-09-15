import { verifiedResolve } from "@/lib/verifiedResolve";

const MAX_GOALS = 4;

export type BatchVerifiedResolveInput = {
  goal: string;
  url?: string;
};

export async function batchVerifiedResolve(items: BatchVerifiedResolveInput[]) {
  const safeItems = items.slice(0, MAX_GOALS);
  const startedAt = Date.now();

  const results = await Promise.all(
    safeItems.map(async (item) => {
      const started = Date.now();
      const report = await verifiedResolve(item.goal, item.url);
      return {
        ...report,
        durationMs: Date.now() - started
      };
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    pricing: {
      model: "flat",
      priceUsd: 1,
      asset: "USDC",
      network: "Base"
    },
    limits: {
      maxGoals: MAX_GOALS,
      maxLiveMcpProbesPerGoal: 2,
      maxLiveMcpProbesTotal: MAX_GOALS * 2
    },
    callerSpendingAuthorized: false,
    durationMs: Date.now() - startedAt,
    count: results.length,
    results
  };
}
