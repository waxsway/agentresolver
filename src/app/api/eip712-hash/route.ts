import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { eip712TypedDataHash } from "@/lib/evmAdvanced";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("eip712-hash", async (req) => {
  const body = await req.json().catch(() => null) as { domain?: unknown; types?: unknown; primaryType?: unknown; message?: unknown } | null;
  if (!body?.domain || typeof body.domain !== "object" || Array.isArray(body.domain)) throw new Error("domain must be an object.");
  if (!body.types || typeof body.types !== "object" || Array.isArray(body.types)) throw new Error("types must be an object.");
  if (typeof body.primaryType !== "string") throw new Error("primaryType must be a string.");
  if (!body.message || typeof body.message !== "object" || Array.isArray(body.message)) throw new Error("message must be an object.");
  return eip712TypedDataHash({
    domain: body.domain as Record<string, unknown>,
    types: body.types as Record<string, Array<{ name: string; type: string }>>,
    primaryType: body.primaryType,
    message: body.message as Record<string, unknown>
  });
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
