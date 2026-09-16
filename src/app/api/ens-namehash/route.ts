import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { ensNamehash } from "@/lib/evmAdvanced";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("ens-namehash", async (req) => {
  const body = await req.json().catch(() => null) as { name?: unknown } | null;
  if (typeof body?.name !== "string") throw new Error("name must be a string.");
  return ensNamehash(body.name);
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
