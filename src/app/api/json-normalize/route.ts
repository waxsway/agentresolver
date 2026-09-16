import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { normalizeJson } from "@/lib/deterministicUtilities";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("json-normalize", async (req) => {
  const body = await req.json().catch(() => null) as { value?: unknown } | null;
  if (!body || !("value" in body)) throw new Error("value is required.");
  return normalizeJson(body.value);
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
