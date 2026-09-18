import { randomUUID } from "node:crypto";
import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { X402_PING_NEXT_ACTIONS } from "@/lib/x402PingDiscovery";

export const dynamic = "force-dynamic";

/**
 * Base-only Coinbase CDP canary used to earn the first external CDP settlement
 * required for Bazaar/Agentic Market discovery. It deliberately reuses the
 * x402-ping product contract while keeping the canonical $0.001 x402-ping route
 * on PayAI. The CDP-only leg uses $0.002 to stay above the hosted facilitator's
 * observed Base minimum instead of advertising an un-settleable dust amount.
 */
const route = createDeterministicPaidRoute("x402-ping", async (req) => {
  const queryEcho = req.method === "GET" ? req.nextUrl.searchParams.get("echo") : null;
  const body = req.method === "GET"
    ? {}
    : await req.json().catch(() => ({})) as { echo?: unknown };
  const bodyEcho = typeof body?.echo === "string" ? body.echo : null;
  const echo = (queryEcho ?? bodyEcho)?.slice(0, 256) ?? null;

  return {
    pong: true,
    settledDelivery: true,
    at: new Date().toISOString(),
    unixMs: Date.now(),
    requestId: randomUUID(),
    echo,
    next: X402_PING_NEXT_ACTIONS
  };
}, {
  paidGet: true,
  endpoint: "/api/x402-cdp-canary",
  priceOverride: "$0.002",
  basePaymentRail: "coinbase-cdp"
});

export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
