import assert from "node:assert/strict";
import test from "node:test";
import { keccak256, stringToHex } from "viem";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/x402-settlement-verify/route";
import {
  BASE_USDC,
  verifyX402Settlement,
  type BaseRpc
} from "../src/lib/x402SettlementVerify";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const PAY_TO = "0x66e19457ffc829e8ed74706f5c1399c6f6466de8";
const TX = "0x7729766d8615c6bd052340bddc95019be20afd78c2cd39faa4812775e3227b72";
const SELECTOR = keccak256(stringToHex(
  "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)"
)).slice(0, 10);

function addressTopic(address: string) {
  return `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
}

async function withMockPayAiSupported<T>(run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url === "https://facilitator.payai.network/supported") {
      return new Response(JSON.stringify({
        kinds: [
          { x402Version: 2, scheme: "exact", network: "eip155:8453", extra: {} },
          {
            x402Version: 2,
            scheme: "exact",
            network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            extra: { feePayer: "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4" }
          }
        ],
        extensions: ["bazaar"],
        signers: {}
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    return originalFetch(input, init);
  };

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("settlement verifier confirms exact Base USDC EIP-3009 transfer expectations", async () => {
  const rpc: BaseRpc = async (method) => {
    if (method === "eth_getTransactionReceipt") {
      return {
        status: "0x1",
        blockNumber: "0x64",
        logs: [{
          address: BASE_USDC,
          topics: [
            TRANSFER_TOPIC,
            addressTopic("0x1111111111111111111111111111111111111111"),
            addressTopic(PAY_TO)
          ],
          data: "0x3e8"
        }]
      };
    }
    if (method === "eth_getTransactionByHash") {
      return {
        to: BASE_USDC,
        input: `${SELECTOR}${"00".repeat(128)}`
      };
    }
    if (method === "eth_blockNumber") return "0x69";
    throw new Error(`unexpected RPC method ${method}`);
  };

  const result = await verifyX402Settlement({
    txHash: TX,
    expectedPayTo: PAY_TO,
    expectedAmountAtomic: "1000"
  }, { rpc });

  assert.equal(result.verdict, "verified");
  assert.equal(result.settled, true);
  assert.equal(result.paymentShape, "eip3009-exact");
  assert.equal(result.confirmations, "6");
  assert.equal(result.transferCount, 1);
  assert.equal(result.assertions.payToMatch, true);
  assert.equal(result.assertions.amountMatch, true);
  assert.equal(result.assertions.exactTransferMatch, true);
});

test("settlement verifier fails closed on a transfer expectation mismatch", async () => {
  const rpc: BaseRpc = async (method) => {
    if (method === "eth_getTransactionReceipt") {
      return {
        status: "0x1",
        blockNumber: "0x64",
        logs: [{
          address: BASE_USDC,
          topics: [
            TRANSFER_TOPIC,
            addressTopic("0x1111111111111111111111111111111111111111"),
            addressTopic(PAY_TO)
          ],
          data: "0x3e8"
        }]
      };
    }
    if (method === "eth_getTransactionByHash") {
      return { to: BASE_USDC, input: SELECTOR };
    }
    if (method === "eth_blockNumber") return "0x64";
    throw new Error(`unexpected RPC method ${method}`);
  };

  const result = await verifyX402Settlement({
    txHash: TX,
    expectedPayTo: "0x2222222222222222222222222222222222222222",
    expectedAmountAtomic: "1000"
  }, { rpc });

  assert.equal(result.verdict, "expectation_mismatch");
  assert.equal(result.settled, false);
  assert.equal(result.assertions.payToMatch, false);
  assert.equal(result.assertions.amountMatch, true);
  assert.equal(result.assertions.exactTransferMatch, false);
});

test("settlement verify GET is a $0.001 paid route with no request body", async () => {
  const url =
    "https://agentresolver.vercel.app/api/x402-settlement-verify" +
    `?txHash=${TX}&expectedPayTo=${PAY_TO}&expectedAmountAtomic=1000`;
  const response = await withMockPayAiSupported(() =>
    GET(new NextRequest(url, {
      method: "GET",
      headers: { "user-agent": "agentresolver-test" }
    }))
  );

  assert.equal(response.status, 402);
  const body = await response.json() as any;
  assert.equal(body.resource?.url, url);
  assert.equal(body.buyerSetup, undefined);
  assert.equal(body.extensions?.agentresolver?.info?.method, "GET");
  assert.ok(body.accepts?.some((item: any) =>
    item.network === "eip155:8453" &&
    item.amount === "1000" &&
    item.payTo === "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
  ));
});
