import { randomUUID } from "node:crypto";
import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { X402_PING_NEXT_ACTIONS } from "@/lib/x402PingDiscovery";

export const dynamic = "force-dynamic";
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
}, { paidGet: true, minimalChallenge: true });
export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
