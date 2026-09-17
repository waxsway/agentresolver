import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("NoHumans payment flow is pinned to the authorized $3 Base USDC terms", async () => {
  const quote = await readFile("src/app/api/nohumans-single-quote/route.ts", "utf8");
  const pay = await readFile("src/app/api/nohumans-single-pay/route.ts", "utf8");
  const page = await readFile("src/app/nohumans-pay/page.tsx", "utf8");

  for (const source of [quote, pay]) {
    assert.match(source, /eip155:8453/);
    assert.match(source, /3000000/);
    assert.match(source, /0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/i);
    assert.match(source, /0xA733875f2F7E8A2817040B5c60B63Ae07D58a1d6/i);
  }

  assert.match(pay, /NOHUMANS_OWNER_TOKEN/);
  assert.match(pay, /payment_terms_mismatch/);
  assert.match(page, /eth_signTypedData_v4/);
  assert.match(page, /TransferWithAuthorization/);
  assert.match(page, /Pay 3 USDC with MetaMask/);
});
