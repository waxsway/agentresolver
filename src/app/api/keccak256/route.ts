import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { ethereumKeccak256 } from "@/lib/evmPrecision";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("keccak256", async (req) => {
  const body = await req.json().catch(() => null) as { input?: unknown; encoding?: unknown } | null;
  if (typeof body?.input !== "string") throw new Error("input must be a string.");
  if (body.encoding !== undefined && body.encoding !== "utf8" && body.encoding !== "hex") throw new Error("encoding must be utf8 or hex.");
  return ethereumKeccak256(body.input, (body.encoding as "utf8" | "hex" | undefined) ?? "utf8");
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
