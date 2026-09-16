import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { runHashEncode } from "@/lib/hashEncode";

export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("hmac-sha256", async (req) => {
  const body = await req.json().catch(() => null) as { input?: unknown; secret?: unknown } | null;
  if (typeof body?.input !== "string") throw new Error("input must be a string.");
  if (typeof body.secret !== "string" || !body.secret) throw new Error("secret must be a non-empty string.");
  return runHashEncode({ operation: "hmac-sha256", input: body.input, secret: body.secret as string });
});
export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
