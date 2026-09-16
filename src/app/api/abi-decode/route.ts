import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { ethereumAbiDecode } from "@/lib/evmAdvanced";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("abi-decode", async (req) => {
  const body = await req.json().catch(() => null) as { types?: unknown; data?: unknown } | null;
  if (!Array.isArray(body?.types) || !body.types.every((item) => typeof item === "string")) throw new Error("types must be a string array.");
  if (typeof body.data !== "string") throw new Error("data must be a hex string.");
  return ethereumAbiDecode({ types: body.types as string[], data: body.data });
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
