import assert from "node:assert/strict";
import test from "node:test";
import { keccak256, stringToHex } from "viem";
import {
  parseProviderConversionVerifyInput,
  verifyProviderConversion
} from "../src/lib/providerConversionVerification";
import { BASE_USDC, type BaseRpc } from "../src/lib/x402SettlementVerify";
import { createSignedAttributionReceipt } from "../src/lib/attributionReceipt";

const ATTRIBUTION = "atr_123e4567-e89b-42d3-a456-426614174000";
const TX = "0x7729766d8615c6bd052340bddc95019be20afd78c2cd39faa4812775e3227b72";
const PAY_TO = "0x2222222222222222222222222222222222222222";
const SELECTOR = keccak256(stringToHex(
  "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)"
)).slice(0, 10);
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const SIGNING_SECRET =
  "test-agentresolver-attribution-signing-secret-00000000000000000000";
const RECEIPT_ISSUED_AT = new Date("2026-01-01T00:00:00.000Z");
const RECEIPT_TTL_SECONDS = 120;
const SETTLEMENT_INSIDE_WINDOW = "2026-01-01T00:01:00.000Z";

function topic(address: string) {
  return `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
}

const env = {
  AGENTRESOLVER_PROVIDER_REGISTRY_JSON: JSON.stringify([{
    routeId: "searchco:web-search",
    providerId: "searchco",
    providerName: "SearchCo",
    capabilityId: "web-search",
    name: "Web Search",
    description: "Search public web data",
    tags: ["search", "web"],
    endpoint: "https://search.example/api",
    method: "POST",
    priceUsd: 0.01,
    network: "eip155:8453",
    commissionUsd: 0.001,
    paymentIdentity: {
      network: "eip155:8453",
      asset: BASE_USDC,
      payTo: PAY_TO,
      amountAtomic: "10000"
    }
  }])
};

function rpcFor(
  payTo: string,
  blockTimestamp: string | null = SETTLEMENT_INSIDE_WINDOW
): BaseRpc {
  return async (method) => {
    if (method === "eth_getTransactionReceipt") {
      return {
        status: "0x1",
        blockNumber: "0x64",
        logs: [{
          address: BASE_USDC,
          topics: [
            TRANSFER_TOPIC,
            topic("0x1111111111111111111111111111111111111111"),
            topic(payTo)
          ],
          data: "0x2710"
        }]
      };
    }
    if (method === "eth_getTransactionByHash") {
      return {
        to: BASE_USDC,
        input: `${SELECTOR}${"00".repeat(128)}`
      };
    }
    if (method === "eth_blockNumber") return "0x65";
    if (method === "eth_getBlockByNumber") {
      if (!blockTimestamp) return null;
      return {
        timestamp: `0x${Math.floor(Date.parse(blockTimestamp) / 1000).toString(16)}`
      };
    }
    throw new Error(`unexpected RPC method ${method}`);
  };
}

test("provider conversion verification proves the registered Base USDC buyer settlement", async () => {
  const report = await verifyProviderConversion({
    attributionId: ATTRIBUTION,
    routeId: "searchco:web-search",
    providerId: "searchco",
    buyerTxHash: TX
  }, { env, rpc: rpcFor(PAY_TO) });

  assert.equal(report.eligibleForFeeSettlement, true);
  assert.equal(report.buyerSettlementVerified, true);
  assert.equal(report.attributionVerified, false);
  assert.equal(report.settlement?.verdict, "verified");
  assert.match(report.attribution.limitation, /provider-asserted/i);
});

test("provider conversion verification fails closed when the buyer paid another recipient", async () => {
  const report = await verifyProviderConversion({
    attributionId: ATTRIBUTION,
    routeId: "searchco:web-search",
    providerId: "searchco",
    buyerTxHash: TX
  }, {
    env,
    rpc: rpcFor("0x3333333333333333333333333333333333333333")
  });

  assert.equal(report.eligibleForFeeSettlement, false);
  assert.equal(report.buyerSettlementVerified, false);
  assert.equal(report.settlement?.verdict, "expectation_mismatch");
});

test("provider conversion parser rejects malformed or incomplete proof", () => {
  assert.throws(() => parseProviderConversionVerifyInput({
    attributionId: ATTRIBUTION,
    routeId: "searchco:web-search",
    providerId: "searchco",
    buyerTxHash: "not-a-tx"
  }));

  assert.throws(() => parseProviderConversionVerifyInput({
    attributionId: "bad",
    routeId: "searchco:web-search",
    providerId: "searchco",
    buyerTxHash: TX
  }));
});


function signedReceipt(overrides: Partial<{
  routeId: string;
  providerId: string;
  capabilityId: string;
  payTo: string;
}> = {}) {
  return createSignedAttributionReceipt({
    attributionId: ATTRIBUTION,
    routeId: overrides.routeId ?? "searchco:web-search",
    providerId: overrides.providerId ?? "searchco",
    capabilityId: overrides.capabilityId ?? "web-search",
    execute: {
      method: "POST",
      url: "https://search.example/api",
      priceUsd: 0.01,
      network: "eip155:8453",
      asset: BASE_USDC,
      payTo: overrides.payTo ?? PAY_TO,
      amountAtomic: "10000"
    },
    inputFingerprint: "signed-input-fingerprint"
  }, SIGNING_SECRET, {
    now: RECEIPT_ISSUED_AT,
    ttlSeconds: RECEIPT_TTL_SECONDS
  }).receipt;
}

test("configured signing accepts later proof when buyer settlement occurred inside the signed handoff window", async () => {
  const signedEnv = {
    ...env,
    AGENTRESOLVER_ATTRIBUTION_SIGNING_SECRET: SIGNING_SECRET
  };

  const report = await verifyProviderConversion({
    attributionId: ATTRIBUTION,
    routeId: "searchco:web-search",
    providerId: "searchco",
    buyerTxHash: TX,
    attributionReceipt: signedReceipt()
  }, {
    env: signedEnv,
    rpc: rpcFor(PAY_TO)
  });

  assert.equal(report.eligibleForFeeSettlement, true);
  assert.equal(report.buyerSettlementVerified, true);
  assert.equal(report.attributionVerified, true);
  assert.equal(report.attribution.cryptographicallyVerified, true);
  assert.equal(report.reason, "buyer_settlement_and_attribution_receipt_verified");
  assert.equal(report.settlement?.blockTimestamp, SETTLEMENT_INSIDE_WINDOW);
  assert.equal(report.attribution.settlementWithinReceiptWindow, true);
  assert.equal(report.attribution.receiptExpiresAt, "2026-01-01T00:02:00.000Z");
});

test("configured signing fails closed before chain lookup when receipt is missing", async () => {
  const signedEnv = {
    ...env,
    AGENTRESOLVER_ATTRIBUTION_SIGNING_SECRET: SIGNING_SECRET
  };
  let rpcCalled = false;

  const report = await verifyProviderConversion({
    attributionId: ATTRIBUTION,
    routeId: "searchco:web-search",
    providerId: "searchco",
    buyerTxHash: TX
  }, {
    env: signedEnv,
    rpc: async () => {
      rpcCalled = true;
      throw new Error("rpc should not run");
    }
  });

  assert.equal(report.eligibleForFeeSettlement, false);
  assert.equal(report.reason, "attribution_receipt_required");
  assert.equal(report.attributionVerified, false);
  assert.equal(rpcCalled, false);
});

test("configured signing rejects a signed receipt for a different payment identity", async () => {
  const signedEnv = {
    ...env,
    AGENTRESOLVER_ATTRIBUTION_SIGNING_SECRET: SIGNING_SECRET
  };

  const report = await verifyProviderConversion({
    attributionId: ATTRIBUTION,
    routeId: "searchco:web-search",
    providerId: "searchco",
    buyerTxHash: TX,
    attributionReceipt: signedReceipt({
      payTo: "0x3333333333333333333333333333333333333333"
    })
  }, {
    env: signedEnv,
    rpc: rpcFor(PAY_TO)
  });

  assert.equal(report.eligibleForFeeSettlement, false);
  assert.equal(report.attributionVerified, false);
  assert.equal(report.reason, "attribution_receipt_handoff_mismatch");
});


test("configured signing rejects a buyer settlement after the signed handoff window", async () => {
  const signedEnv = {
    ...env,
    AGENTRESOLVER_ATTRIBUTION_SIGNING_SECRET: SIGNING_SECRET
  };

  const report = await verifyProviderConversion({
    attributionId: ATTRIBUTION,
    routeId: "searchco:web-search",
    providerId: "searchco",
    buyerTxHash: TX,
    attributionReceipt: signedReceipt()
  }, {
    env: signedEnv,
    rpc: rpcFor(PAY_TO, "2026-01-01T00:03:00.000Z")
  });

  assert.equal(report.buyerSettlementVerified, true);
  assert.equal(report.attributionVerified, true);
  assert.equal(report.eligibleForFeeSettlement, false);
  assert.equal(report.successFeeQuote, null);
  assert.equal(report.attribution.settlementWithinReceiptWindow, false);
  assert.equal(report.reason, "buyer_settlement_after_attribution_window");
});

test("configured signing rejects a buyer settlement before the signed handoff window", async () => {
  const signedEnv = {
    ...env,
    AGENTRESOLVER_ATTRIBUTION_SIGNING_SECRET: SIGNING_SECRET
  };

  const report = await verifyProviderConversion({
    attributionId: ATTRIBUTION,
    routeId: "searchco:web-search",
    providerId: "searchco",
    buyerTxHash: TX,
    attributionReceipt: signedReceipt()
  }, {
    env: signedEnv,
    rpc: rpcFor(PAY_TO, "2025-12-31T23:59:59.000Z")
  });

  assert.equal(report.buyerSettlementVerified, true);
  assert.equal(report.attributionVerified, true);
  assert.equal(report.eligibleForFeeSettlement, false);
  assert.equal(report.reason, "buyer_settlement_before_attribution_window");
});

test("configured signing fails fee eligibility closed when settlement block time is unavailable", async () => {
  const signedEnv = {
    ...env,
    AGENTRESOLVER_ATTRIBUTION_SIGNING_SECRET: SIGNING_SECRET
  };

  const report = await verifyProviderConversion({
    attributionId: ATTRIBUTION,
    routeId: "searchco:web-search",
    providerId: "searchco",
    buyerTxHash: TX,
    attributionReceipt: signedReceipt()
  }, {
    env: signedEnv,
    rpc: rpcFor(PAY_TO, null)
  });

  assert.equal(report.buyerSettlementVerified, true);
  assert.equal(report.attributionVerified, true);
  assert.equal(report.eligibleForFeeSettlement, false);
  assert.equal(report.successFeeQuote, null);
  assert.equal(report.reason, "buyer_settlement_timestamp_unavailable");
});
