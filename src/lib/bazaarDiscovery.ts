import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import { verifiedResolveGetDiscoveryInput } from "@/lib/x402RuntimeDiscovery";

const GENERIC_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: true
} as const;

export { bazaarResourceServerExtension };

export function paidRouteBazaarExtension(
  capabilityId: PaidCapabilityId,
  requestMethod = "POST"
) {
  const product = getPaidCapability(capabilityId);
  const normalizedMethod = requestMethod.toUpperCase();
  const queryMethod =
    capabilityId === "verified-resolve" &&
    (normalizedMethod === "GET" || normalizedMethod === "HEAD");
  const getInput = queryMethod
    ? verifiedResolveGetDiscoveryInput()
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
