import { NextRequest } from "next/server";
import { createDeterministicPaidRoute, optionalJsonObject } from "@/lib/createDeterministicPaidRoute";
import { X402_PING_NEXT_ACTIONS } from "@/lib/x402PingDiscovery";

const route = createDeterministicPaidRoute({
  capabilityId: "x402-ping",
  readPayload: async (request) => {
    if (request.method === "GET") return {};
    return optionalJsonObject(request);
  },
  run: async (payload, context) => {
    const echo = typeof payload.echo === "string" ? payload.echo.slice(0, 256) : null;
    return {
      pong: true,
      settledDelivery: true,
      at: context.now.toISOString(),
      unixMs: context.now.getTime(),
      requestId: context.requestId,
      echo,
      next: X402_PING_NEXT_ACTIONS
    };
  }
});

export const GET = route;
export const POST = route;
