import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import {
  parseProviderLaunchCheckInput,
  providerLaunchReferenceInput,
  runProviderLaunchCheck
} from "@/lib/providerLaunchCheck";

export const dynamic = "force-dynamic";

const route = createDeterministicPaidRoute(
  "provider-launch-check",
  async (req) => {
    const referenceMode = req.method === "GET";
    const input = referenceMode
      ? providerLaunchReferenceInput(req.nextUrl.searchParams)
      : parseProviderLaunchCheckInput(await req.json().catch(() => null));
    const report = await runProviderLaunchCheck(input);
    return {
      ...report,
      invocation: {
        method: req.method,
        referenceSample: referenceMode && req.nextUrl.searchParams.size === 0,
        note: referenceMode
          ? "GET supports paid machine probes and can accept provider fields as query parameters. Sellers should use POST for their full onboarding packet."
          : "POST evaluates the seller-supplied onboarding packet."
      }
    };
  },
  { paidGet: true }
);

export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
