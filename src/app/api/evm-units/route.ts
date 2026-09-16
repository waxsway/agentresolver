import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { convertEvmUnits } from "@/lib/evmPrecision";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("evm-units", async (req) => {
  const body = await req.json().catch(() => null) as { mode?: unknown; value?: unknown; decimals?: unknown } | null;
  if (body?.mode !== "parse" && body?.mode !== "format") throw new Error("mode must be parse or format.");
  if (typeof body.value !== "string") throw new Error("value must be a string.");
  if (typeof body.decimals !== "number") throw new Error("decimals must be a number.");
  return convertEvmUnits({ mode: body.mode, value: body.value, decimals: body.decimals });
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
