import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { generateUuidV4 } from "@/lib/deterministicUtilities";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("uuid-v4", async (req) => {
  const body = await req.json().catch(() => ({})) as { count?: unknown };
  const count = body?.count === undefined ? 1 : body.count;
  if (typeof count !== "number") throw new Error("count must be a number.");
  return generateUuidV4(count);
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
