import type { PaidCapability } from "@/lib/paidCapabilities";

const MAX_X402_TAGS = 5;
const MAX_X402_TAG_LENGTH = 32;
const MAX_WIRE_DESCRIPTION_LENGTH = 240;

function printableAscii(value: string) {
  return /^[\x20-\x7E]+$/.test(value);
}

function truncateDescription(value: string) {
  if (value.length <= MAX_WIRE_DESCRIPTION_LENGTH) return value;
  return value.slice(0, MAX_WIRE_DESCRIPTION_LENGTH - 3).trimEnd() + "...";
}

export function x402WireResourceMetadata(capability: PaidCapability) {
  const preferredDescription = capability.id === "x402-payment-preflight"
    ? "Fail-closed x402 prepayment gate for autonomous buyers. Validate live payTo, USDC amount, network, asset, scheme and resource binding; return eligible/blocked plus exact observed payment terms before caller authorization."
    : capability.description;

  const tags = [...capability.tags, "agents", "x402"]
    .map((tag) => tag.trim())
    .filter((tag, index, all) =>
      tag.length > 0 &&
      tag.length <= MAX_X402_TAG_LENGTH &&
      printableAscii(tag) &&
      all.indexOf(tag) === index
    )
    .slice(0, MAX_X402_TAGS);

  return {
    description: truncateDescription(preferredDescription),
    serviceName: "AgentResolver",
    tags
  } as const;
}
