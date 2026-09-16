import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { runHashEncode } from "@/lib/hashEncode";

export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("sha512", async (req) => {
  const body = await req.json().catch(() => null) as { input?: unknown; secret?: unknown } | null;
  if (typeof body?.input !== "string") throw new Error("input must be a string.");
  
  return runHashEncode({ operation: "sha512", input: body.input });
});
export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
