import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";

const GENERIC_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: true
} as const;

export { bazaarResourceServerExtension };

export function paidRouteBazaarExtension(capabilityId: PaidCapabilityId) {
  const product = getPaidCapability(capabilityId);
  return {
    ...declareDiscoveryExtension({
      input: product.example,
      inputSchema: product.inputSchema,
      bodyType: "json",
      output: {
        example: {},
        schema: GENERIC_OUTPUT_SCHEMA
      }
    })
  };
}
