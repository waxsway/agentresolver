import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { parseUrl } from "@/lib/deterministicUtilities";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("url-parse", async (req) => {
  const body = await req.json().catch(() => null) as { url?: unknown } | null;
  if (typeof body?.url !== "string") throw new Error("url must be a string.");
  return parseUrl(body.url);
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
