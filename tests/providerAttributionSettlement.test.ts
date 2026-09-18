import assert from "node:assert/strict";
import test from "node:test";
import { parseProviderSettlementInput } from "../src/lib/providerAttributionSettlement";
import { isAttributionId } from "../src/lib/transactionAttribution";

const id = "atr_123e4567-e89b-42d3-a456-426614174000";

test("provider attribution settlement accepts bounded provider evidence and hashes external references", () => {
  assert.equal(isAttributionId(id), true);
  const parsed = parseProviderSettlementInput({
    attributionId: id,
    providerId: "searchco",
    outcome: "fulfilled",
    externalTransactionRef: "provider-order-123"
  });
  assert.equal(parsed.attributionId, id);
  assert.equal(parsed.providerId, "searchco");
  assert.equal(parsed.outcome, "fulfilled");
  assert.match(parsed.externalTransactionRefHash || "", /^[0-9a-f]{16}$/);
});

test("provider attribution settlement rejects malformed attribution ids", () => {
  assert.throws(() => parseProviderSettlementInput({
    attributionId: "not-an-attribution",
    providerId: "searchco",
    outcome: "fulfilled"
  }));
});
