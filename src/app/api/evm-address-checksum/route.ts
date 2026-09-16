import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { evmAddressChecksum } from "@/lib/evmPrecision";
export const dynamic = "force-dynamic";
const route = createDeterministicPaidRoute("evm-address-checksum", async (req) => {
  const body = await req.json().catch(() => null) as { address?: unknown } | null;
  if (typeof body?.address !== "string") throw new Error("address must be a string.");
  return evmAddressChecksum(body.address);
});
export const POST = route.POST; export const GET = route.GET; export const OPTIONS = route.OPTIONS;
