import { randomUUID } from "node:crypto";
import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { X402_PING_NEXT_ACTIONS } from "@/lib/x402PingDiscovery";

export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("x402-ping", async (req) => {
  const body = await req.json().catch(() => ({})) as { echo?: unknown };
  const echo = typeof body?.echo === "string" ? body.echo.slice(0, 256) : null;
  return {
    pong: true,
    settledDelivery: true,
    at: new Date().toISOString(),
    unixMs: Date.now(),
    requestId: randomUUID(),
    echo,
    next: X402_PING_NEXT_ACTIONS
  };
}, { paidGet: true });
export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
