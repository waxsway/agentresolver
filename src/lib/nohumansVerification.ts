import type { PaymentRequired } from "@x402/core/types";

export const NOHUMANS_LISTING_ID = "e37797ba-55b";
export const NOHUMANS_SINGLE_ENDPOINT =
  "https://api.nohumans.directory/v1/listings/e37797ba-55b/verify-now?plan=single";
export const NOHUMANS_BASE_NETWORK = "eip155:8453";
export const NOHUMANS_SINGLE_AMOUNT = "3000000";
export const BASE_USDC = "0x833589fCD6E08f4c7C32D4f71b54bdA02913";
export const NOHUMANS_PAY_TO = "0xA733875f2F7E8A2817040B5c60B63Ae07D58a1d6";

export function assertNoHumansSingleInvoice(value: unknown): asserts value is PaymentRequired {
  if (!value || typeof value !== "object") {
    throw new Error("NoHumans invoice is not an object");
  }

  const invoice = value as {
    x402Version?: unknown;
    accepts?: Array<Record<string, unknown>>;
  };

  if (invoice.x402Version !== 2 || !Array.isArray(invoice.accepts)) {
    throw new Error("NoHumans invoice is not x402 v2");
  }

  const accepted = invoice.accepts.find(
    item =>
      item.scheme === "exact" &&
      item.network === NOHUMANS_BASE_NETWORK &&
      String(item.amount ?? item.maxAmountRequired ?? "") === NOHUMANS_SINGLE_AMOUNT &&
      String(item.asset ?? "").toLowerCase() === BASE_USDC.toLowerCase() &&
      String(item.payTo ?? "").toLowerCase() === NOHUMANS_PAY_TO.toLowerCase(),
  );

  if (!accepted) {
    throw new Error("NoHumans invoice terms changed; refusing to authorize payment");
  }
}
