import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import {
  buildAgentDistributionPack,
  parseAgentDistributionPackInput
} from "@/lib/agentDistributionPack";

export const dynamic = "force-dynamic";

const route = createDeterministicPaidRoute(
  "agent-distribution-pack",
  async (req) => {
    const input = parseAgentDistributionPackInput(await req.json().catch(() => null));
    return buildAgentDistributionPack(input);
  }
);

export const POST = route.POST;
export const OPTIONS = route.OPTIONS;
