import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import { x402RuntimeDiscoveryInput } from "@/lib/x402RuntimeDiscovery";

const GENERIC_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: true
} as const;

export { bazaarResourceServerExtension };

export function paidRouteBazaarExtension(capabilityId: PaidCapabilityId) {
  const product = getPaidCapability(capabilityId);
  const getInput =
    capabilityId === "verified-resolve"
      ? x402RuntimeDiscoveryInput(capabilityId)
      : null;

  return {
    ...declareDiscoveryExtension({
      input: getInput?.example ?? product.example,
      inputSchema: getInput?.schema ?? product.inputSchema,
      ...(getInput ? {} : { bodyType: "json" as const }),
      output: {
        example: {},
        schema: GENERIC_OUTPUT_SCHEMA
      }
    })
  };
}
