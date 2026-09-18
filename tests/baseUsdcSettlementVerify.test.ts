import assert from "node:assert/strict";
import test from "node:test";
import { BASE_USDC, verifyBaseUsdcSettlement } from "../src/lib/baseUsdcSettlementVerify";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const payTo = "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8";
const payer = "0x1111111111111111111111111111111111111111";
const tx = `0x${"ab".repeat(32)}`;

function addressTopic(address: string) {
  return `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
}

test("Base USDC settlement verifier confirms exact payee, amount and confirmations", async () => {
  const rpc = async (method: string) => {
    if (method === "eth_getTransactionReceipt") {
      return {
        status: "0x1",
        blockNumber: "0x64",
        logs: [{
          address: BASE_USDC,
          topics: [TRANSFER_TOPIC, addressTopic(payer), addressTopic(payTo)],
          data: "0x3e8"
        }]
      };
    }
    if (method === "eth_blockNumber") return "0x66";
    throw new Error("unexpected RPC method");
  };

  const result = await verifyBaseUsdcSettlement({
    transactionHash: tx,
    expectedPayTo: payTo,
    expectedAmountAtomic: "1000",
    minimumConfirmations: 2
  }, rpc);

  assert.equal(result.settlementVerified, true);
  assert.equal(result.transactionSucceeded, true);
  assert.equal(result.confirmations, 3);
  assert.equal(result.observedAmountAtomic, "1000");
  assert.deepEqual(result.reasonCodes, []);
});

test("Base USDC settlement verifier fails closed on payee mismatch", async () => {
  const rpc = async (method: string) => {
    if (method === "eth_getTransactionReceipt") {
      return {
        status: "0x1",
        blockNumber: "0x64",
        logs: [{
          address: BASE_USDC,
          topics: [TRANSFER_TOPIC, addressTopic(payer), addressTopic(payTo)],
          data: "0x3e8"
        }]
      };
    }
    if (method === "eth_blockNumber") return "0x64";
    throw new Error("unexpected RPC method");
  };

  const result = await verifyBaseUsdcSettlement({
    transactionHash: tx,
    expectedPayTo: "0x2222222222222222222222222222222222222222",
    expectedAmountAtomic: "1000"
  }, rpc);

  assert.equal(result.settlementVerified, false);
  assert.ok(result.reasonCodes.includes("expected_payee_not_found"));
  assert.ok(result.reasonCodes.includes("expected_amount_mismatch"));
});
