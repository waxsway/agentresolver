import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNoHumansSingleInvoice,
  BASE_USDC,
  NOHUMANS_PAY_TO,
} from "../src/lib/nohumansVerification";

const valid = {
  x402Version: 2,
  resource: { url: "https://api.nohumans.directory/v1/listings/28e33786-f07/verify-now" },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:8453",
      amount: "3000000",
      asset: BASE_USDC,
      payTo: NOHUMANS_PAY_TO,
    },
  ],
};

test("accepts the exact authorized NoHumans $3 invoice", () => {
  assert.doesNotThrow(() => assertNoHumansSingleInvoice(valid));
});

test("rejects any changed NoHumans payment terms", () => {
  assert.throws(() =>
    assertNoHumansSingleInvoice({
      ...valid,
      accepts: [{ ...valid.accepts[0], amount: "3000001" }],
    }),
  );
  assert.throws(() =>
    assertNoHumansSingleInvoice({
      ...valid,
      accepts: [{ ...valid.accepts[0], payTo: "0x0000000000000000000000000000000000000000" }],
    }),
  );
});
