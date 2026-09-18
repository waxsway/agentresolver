import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { parseProviderLaunchCheckInput, runProviderLaunchCheck } from "@/lib/providerLaunchCheck";

export const dynamic = "force-dynamic";

const route = createDeterministicPaidRoute(
  "provider-launch-check",
  async (req) => {
    const input = parseProviderLaunchCheckInput(await req.json().catch(() => null));
    return runProviderLaunchCheck(input);
  }
);

export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
