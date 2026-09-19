import assert from "node:assert/strict";
import test from "node:test";
import { keccak256, stringToHex } from "viem";
import {
  quoteVerifiedProviderSuccessFee,
  verifyProviderSuccessFee
} from "../src/lib/providerSuccessFee";
import {
  quoteProviderSuccessFee,
  type DomainProviderRoute
} from "../src/lib/providerManifest";
import {
  BASE_USDC,
  type BaseRpc
} from "../src/lib/x402SettlementVerify";

const ATTRIBUTION = "atr_123e4567-e89b-42d3-a456-426614174000";
const BUYER_TX =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const FEE_TX =
  "0x2222222222222222222222222222222222222222222222222222222222222222";
const PROVIDER_PAY_TO = "0x2222222222222222222222222222222222222222";
const AGENTRESOLVER_PAY_TO = "0x4444444444444444444444444444444444444444";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const SELECTOR = keccak256(stringToHex(
  "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)"
)).slice(0, 10);

function topic(address: string) {
  return `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
}

function hexAmount(amount: string) {
  return `0x${BigInt(amount).toString(16)}`;
}

const domainRoute: DomainProviderRoute = {
  manifestUrl:
    "https://provider.example/.well-known/agentresolver-provider.json",
  origin: "https://provider.example",
  providerId: "searchco",
  providerName: "SearchCo",
  routeId: "searchco:web-search",
  capabilityId: "web-search",
  name: "Web Search",
  description: "Search public web data.",
  tags: ["search", "web"],
  endpoint: "https://provider.example/api/search",
  method: "GET",
  priceUsd: 1,
  network: "eip155:8453",
  asset: BASE_USDC,
  payTo: PROVIDER_PAY_TO,
  amountAtomic: "1000000",
  successFeeBps: 200,
  minimumSuccessFeeUsd: 0.001
};

const feeQuote = quoteProviderSuccessFee("1000000", ATTRIBUTION);

const rpc: BaseRpc = async (method, params) => {
  const hash = String(params[0] || "").toLowerCase();

  if (method === "eth_getTransactionReceipt" && hash === BUYER_TX) {
    return {
      status: "0x1",
      blockNumber: "0x64",
      logs: [{
        address: BASE_USDC,
        topics: [
          TRANSFER_TOPIC,
          topic("0x1111111111111111111111111111111111111111"),
          topic(PROVIDER_PAY_TO)
        ],
        data: hexAmount("1000000")
      }]
    };
  }

  if (method === "eth_getTransactionByHash" && hash === BUYER_TX) {
    return {
      to: BASE_USDC,
      input: `${SELECTOR}${"00".repeat(128)}`
    };
  }

  if (method === "eth_getTransactionReceipt" && hash === FEE_TX) {
    return {
      status: "0x1",
      blockNumber: "0x65",
      logs: [{
        address: BASE_USDC,
        topics: [
          TRANSFER_TOPIC,
          topic("0x3333333333333333333333333333333333333333"),
          topic(AGENTRESOLVER_PAY_TO)
        ],
        data: hexAmount(feeQuote.feeAmountAtomic)
      }]
    };
  }

  if (method === "eth_blockNumber") return "0x66";
  throw new Error(`unexpected RPC call ${method} ${hash}`);
};

const conversion = {
  attributionId: ATTRIBUTION,
  routeId: "searchco:web-search",
  providerId: "searchco",
  providerOrigin: "https://provider.example",
  buyerTxHash: BUYER_TX
};

const options = {
  rpc,
  env: {},
  payTo: AGENTRESOLVER_PAY_TO,
  manifestFetcher: async () => [domainRoute]
};

test("verified domain conversion produces attribution-bound 2 percent success-fee quote", async () => {
  const quote = await quoteVerifiedProviderSuccessFee(conversion, options);
  assert.equal(quote.buyerSettlementVerified, true);
  assert.equal(quote.providerEnrollment, "domain-manifest");
  assert.equal(quote.commercial.model, "two-percent-provider-success-fee");
  assert.equal(quote.commercial.quote.successFeeBps, 200);
  assert.equal(quote.payment.amountAtomic, feeQuote.feeAmountAtomic);
  assert.equal(quote.payment.payTo, AGENTRESOLVER_PAY_TO);
  assert.equal(quote.boundaries.buyerPaysAgentResolverExtraFee, false);
});

test("provider fee verification proves both the buyer sale and AgentResolver fee transfer", async () => {
  const report = await verifyProviderSuccessFee(
    { ...conversion, feeTxHash: FEE_TX },
    options
  );

  assert.equal(report.buyerSettlementVerified, true);
  assert.equal(report.feeSettlementVerified, true);
  assert.equal(report.settled, true);
  assert.equal(
    report.feeSettlement.assertions.expectedAmountAtomic,
    feeQuote.feeAmountAtomic
  );
});

test("same buyer sale cannot settle with a wrong fee transfer amount", async () => {
  const badRpc: BaseRpc = async (method, params) => {
    const hash = String(params[0] || "").toLowerCase();
    if (method === "eth_getTransactionReceipt" && hash === FEE_TX) {
      return {
        status: "0x1",
        blockNumber: "0x65",
        logs: [{
          address: BASE_USDC,
          topics: [
            TRANSFER_TOPIC,
            topic("0x3333333333333333333333333333333333333333"),
            topic(AGENTRESOLVER_PAY_TO)
          ],
          data: hexAmount((BigInt(feeQuote.feeAmountAtomic) - 1n).toString())
        }]
      };
    }
    return rpc(method, params);
  };

  const report = await verifyProviderSuccessFee(
    { ...conversion, feeTxHash: FEE_TX },
    { ...options, rpc: badRpc }
  );

  assert.equal(report.feeSettlementVerified, false);
  assert.equal(report.settled, false);
  assert.equal(report.feeSettlement.verdict, "expectation_mismatch");
});
