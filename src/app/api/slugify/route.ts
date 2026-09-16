import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { slugify } from "@/lib/deterministicUtilities";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("slugify", async (req) => {
  const body = await req.json().catch(() => null) as { text?: unknown; separator?: unknown } | null;
  if (typeof body?.text !== "string") throw new Error("text must be a string.");
  if (body.separator !== undefined && body.separator !== "-" && body.separator !== "_") throw new Error("separator must be '-' or '_'.");
  return slugify(body.text, body.separator as "-" | "_" | undefined);
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
