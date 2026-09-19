import assert from "node:assert/strict";
import test from "node:test";
import { parseProviderSettlementInput } from "../src/lib/providerAttributionSettlement";
import { isAttributionId } from "../src/lib/transactionAttribution";

const id = "atr_123e4567-e89b-42d3-a456-426614174000";
const tx = "0x7729766d8615c6bd052340bddc95019be20afd78c2cd39faa4812775e3227b72";

test("fulfilled provider fee requires bounded on-chain conversion proof", () => {
  assert.equal(isAttributionId(id), true);
  const parsed = parseProviderSettlementInput({
    attributionId: id,
    providerId: "searchco",
    routeId: "searchco:web-search",
    outcome: "fulfilled",
    buyerTxHash: tx,
    externalTransactionRef: "provider-order-123"
  });

  assert.equal(parsed.outcome, "fulfilled");
  if (parsed.outcome !== "fulfilled") throw new Error("unexpected outcome");
  assert.equal(parsed.attributionId, id);
  assert.equal(parsed.providerId, "searchco");
  assert.equal(parsed.routeId, "searchco:web-search");
  assert.equal(parsed.buyerTxHash, tx);
  assert.match(parsed.externalTransactionRefHash || "", /^[0-9a-f]{16}$/);
});

test("fulfilled provider fee rejects missing buyer settlement proof", () => {
  assert.throws(() => parseProviderSettlementInput({
    attributionId: id,
    providerId: "searchco",
    routeId: "searchco:web-search",
    outcome: "fulfilled"
  }));
});

test("qualified lead remains explicit and never claims a buyer transaction", () => {
  const parsed = parseProviderSettlementInput({
    attributionId: id,
    providerId: "searchco",
    outcome: "qualified-lead",
    externalTransactionRef: "lead-123"
  });

  assert.equal(parsed.outcome, "qualified-lead");
  assert.equal(parsed.routeId, null);
  assert.equal(parsed.buyerTxHash, null);
});

test("provider attribution settlement rejects malformed attribution ids", () => {
  assert.throws(() => parseProviderSettlementInput({
    attributionId: "not-an-attribution",
    providerId: "searchco",
    outcome: "qualified-lead"
  }));
});
