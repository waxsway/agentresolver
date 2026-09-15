import { verifiedResolve } from "@/lib/verifiedResolve";
import { getPaidCapability } from "@/lib/paidCapabilities";

const MAX_GOALS = 4;

export type BatchVerifiedResolveInput = {
  goal: string;
  url?: string;
};

export async function batchVerifiedResolve(items: BatchVerifiedResolveInput[]) {
  const safeItems = items.slice(0, MAX_GOALS);
  const startedAt = Date.now();
  const product = getPaidCapability("batch-verified-resolve");

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
      priceUsd: product.priceUsd,
      asset: "USDC",
      network: "Base"
    },
    limits: {
      maxGoals: MAX_GOALS,
      maxLiveProbesPerGoal: 2,
      maxLiveProbesTotal: MAX_GOALS * 2
    },
    callerSpendingAuthorized: false,
    durationMs: Date.now() - startedAt,
    count: results.length,
    results
  };
}
