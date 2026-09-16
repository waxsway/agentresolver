import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { soliditySelector } from "@/lib/evmPrecision";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("solidity-selector", async (req) => {
  const body = await req.json().catch(() => null) as { signature?: unknown } | null;
  if (typeof body?.signature !== "string") throw new Error("signature must be a string.");
  return soliditySelector(body.signature);
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
