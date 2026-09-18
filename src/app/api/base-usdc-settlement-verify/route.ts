import { NextRequest } from "next/server";
import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { verifyBaseUsdcSettlement } from "@/lib/baseUsdcSettlementVerify";

export const dynamic = "force-dynamic";

async function inputFromRequest(req: NextRequest) {
  if (req.method.toUpperCase() === "GET") {
    return {
      transactionHash: req.nextUrl.searchParams.get("transactionHash") ?? "",
      expectedPayTo: req.nextUrl.searchParams.get("expectedPayTo") || undefined,
      expectedAmountAtomic: req.nextUrl.searchParams.get("expectedAmountAtomic") || undefined,
      minimumConfirmations: req.nextUrl.searchParams.get("minimumConfirmations")
        ? Number(req.nextUrl.searchParams.get("minimumConfirmations"))
        : undefined
    };
  }

  const body = await req.json().catch(() => null) as {
    transactionHash?: unknown;
    expectedPayTo?: unknown;
    expectedAmountAtomic?: unknown;
    minimumConfirmations?: unknown;
  } | null;
  return {
    transactionHash: typeof body?.transactionHash === "string" ? body.transactionHash : "",
    expectedPayTo: typeof body?.expectedPayTo === "string" ? body.expectedPayTo : undefined,
    expectedAmountAtomic: typeof body?.expectedAmountAtomic === "string" ? body.expectedAmountAtomic : undefined,
    minimumConfirmations: typeof body?.minimumConfirmations === "number" ? body.minimumConfirmations : undefined
  };
}

const paid = createDeterministicPaidRoute(
  "base-usdc-settlement-verify",
  async (req) => verifyBaseUsdcSettlement(await inputFromRequest(req)),
  { paidGet: true }
);

export const GET = paid.GET;
export const POST = paid.POST;
export const OPTIONS = paid.OPTIONS;
