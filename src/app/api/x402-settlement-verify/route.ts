import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { verifyX402Settlement } from "@/lib/x402SettlementVerify";

export const dynamic = "force-dynamic";

const route = createDeterministicPaidRoute(
  "x402-settlement-verify",
  async (req) => {
    const body = req.method === "GET"
      ? null
      : await req.json().catch(() => null) as Record<string, unknown> | null;

    const txHash = req.method === "GET"
      ? req.nextUrl.searchParams.get("txHash")
      : typeof body?.txHash === "string"
        ? body.txHash
        : null;
    const expectedPayTo = req.method === "GET"
      ? req.nextUrl.searchParams.get("expectedPayTo")
      : typeof body?.expectedPayTo === "string"
        ? body.expectedPayTo
        : undefined;
    const expectedAmountAtomic = req.method === "GET"
      ? req.nextUrl.searchParams.get("expectedAmountAtomic")
      : typeof body?.expectedAmountAtomic === "string"
        ? body.expectedAmountAtomic
        : undefined;

    if (!txHash) throw new Error("txHash is required.");

    return verifyX402Settlement({
      txHash,
      ...(expectedPayTo ? { expectedPayTo } : {}),
      ...(expectedAmountAtomic ? { expectedAmountAtomic } : {})
    });
  },
  { paidGet: true }
);

export const GET = route.GET;
export const POST = route.POST;
export const OPTIONS = route.OPTIONS;
