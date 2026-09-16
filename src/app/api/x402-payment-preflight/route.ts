import { NextRequest } from "next/server";
import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { inspectHttpResource } from "@/lib/httpInspect";

export const dynamic = "force-dynamic";

const route = createDeterministicPaidRoute("x402-payment-preflight", async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as {
    url?: unknown;
    maxPriceUsd?: unknown;
    expectedPayTo?: unknown;
    expectedNetwork?: unknown;
    method?: unknown;
    body?: unknown;
    allowUnpaidPostProbe?: unknown;
  } | null;

  const url = String(body?.url || "").trim();
  const methodRaw = typeof body?.method === "string" ? body.method.toUpperCase() : "GET";
  const method = methodRaw === "GET" || methodRaw === "HEAD" || methodRaw === "POST" ? methodRaw : undefined;
  if (!method) throw new Error("method must be GET, HEAD, or POST.");

  return await inspectHttpResource(url, {
    maxPriceUsd: typeof body?.maxPriceUsd === "number" ? body.maxPriceUsd : undefined,
    expectedPayTo: typeof body?.expectedPayTo === "string" ? body.expectedPayTo.trim() : undefined,
    expectedNetwork: typeof body?.expectedNetwork === "string" ? body.expectedNetwork.trim() : undefined,
    method,
    body: body?.body,
    allowUnpaidPostProbe: body?.allowUnpaidPostProbe === true
  });
});

export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
