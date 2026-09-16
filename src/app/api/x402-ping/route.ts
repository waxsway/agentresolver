import { randomUUID } from "node:crypto";
import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";

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
    echo
  };
}, { paidGet: true });
export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
