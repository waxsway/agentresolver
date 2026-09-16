import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { validateJsonSchema } from "@/lib/deterministicUtilities";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("json-schema-validate", async (req) => {
  const body = await req.json().catch(() => null) as { data?: unknown; schema?: unknown } | null;
  if (!body || !("data" in body) || !body.schema || typeof body.schema !== "object" || Array.isArray(body.schema)) throw new Error("data and schema object are required.");
  return validateJsonSchema(body.data, body.schema as Record<string, unknown>);
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
