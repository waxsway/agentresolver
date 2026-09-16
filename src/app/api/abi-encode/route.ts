import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { ethereumAbiEncode } from "@/lib/evmAdvanced";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("abi-encode", async (req) => {
  const body = await req.json().catch(() => null) as { types?: unknown; values?: unknown } | null;
  if (!Array.isArray(body?.types) || !body.types.every((item) => typeof item === "string")) throw new Error("types must be a string array.");
  if (!Array.isArray(body.values)) throw new Error("values must be an array.");
  return ethereumAbiEncode({ types: body.types as string[], values: body.values });
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
