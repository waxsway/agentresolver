import assert from "node:assert/strict";
import test from "node:test";
import { keccak256, stringToHex } from "viem";
import {
  parseProviderConversionVerifyInput,
  verifyProviderConversion
} from "../src/lib/providerConversionVerification";
import { BASE_USDC, type BaseRpc } from "../src/lib/x402SettlementVerify";

const ATTRIBUTION = "atr_123e4567-e89b-42d3-a456-426614174000";
const TX = "0x7729766d8615c6bd052340bddc95019be20afd78c2cd39faa4812775e3227b72";
const PAY_TO = "0x2222222222222222222222222222222222222222";
const SELECTOR = keccak256(stringToHex(
  "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)"
)).slice(0, 10);
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

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

function rpcFor(payTo: string): BaseRpc {
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
