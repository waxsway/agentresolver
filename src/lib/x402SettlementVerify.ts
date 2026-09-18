import { keccak256, stringToHex } from "viem";

export const BASE_NETWORK = "eip155:8453" as const;
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const BASE_RPC_URL = "https://mainnet.base.org" as const;

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const EIP3009_SELECTORS = new Set([
  "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)",
  "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)",
  "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)",
  "receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)"
].map((signature) => keccak256(stringToHex(signature)).slice(0, 10).toLowerCase()));

type JsonObject = Record<string, unknown>;
export type BaseRpc = (method: string, params: unknown[]) => Promise<unknown>;

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function normalizeAddress(value: string) {
  return value.toLowerCase();
}

function topicAddress(value: unknown): string | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
  return `0x${value.slice(-40).toLowerCase()}`;
}

function parseHex(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

async function defaultBaseRpc(method: string, params: unknown[]) {
  const response = await fetch(BASE_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(4_500)
  });
  if (!response.ok) throw new Error(`Base RPC ${method} returned HTTP ${response.status}.`);
  const payload = await response.json() as { result?: unknown; error?: unknown };
  if (payload.error) throw new Error(`Base RPC ${method} returned an error.`);
  return payload.result ?? null;
}

export type X402SettlementVerifyInput = {
  txHash: string;
  expectedPayTo?: string;
  expectedAmountAtomic?: string;
};

export async function verifyX402Settlement(
  input: X402SettlementVerifyInput,
  options: { rpc?: BaseRpc } = {}
) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.txHash)) {
    throw new Error("txHash must be a 32-byte 0x-prefixed Base transaction hash.");
  }
  if (input.expectedPayTo && !/^0x[0-9a-fA-F]{40}$/.test(input.expectedPayTo)) {
    throw new Error("expectedPayTo must be a 20-byte 0x-prefixed EVM address.");
  }
  if (
    input.expectedAmountAtomic !== undefined &&
    !/^[0-9]{1,78}$/.test(input.expectedAmountAtomic)
  ) {
    throw new Error("expectedAmountAtomic must be a non-negative base-10 integer string.");
  }

  const rpc = options.rpc ?? defaultBaseRpc;
  const [receiptValue, transactionValue] = await Promise.all([
    rpc("eth_getTransactionReceipt", [input.txHash]),
    rpc("eth_getTransactionByHash", [input.txHash])
  ]);

  const receipt = object(receiptValue);
  const transaction = object(transactionValue);
  if (!receipt || !transaction) {
    return {
      network: BASE_NETWORK,
      asset: BASE_USDC,
      txHash: input.txHash.toLowerCase(),
      found: false,
      settled: false,
      verdict: "not_found",
      paymentShape: "unknown",
      confirmations: null,
      transfers: [],
      assertions: {
        expectedPayTo: input.expectedPayTo?.toLowerCase() ?? null,
        expectedAmountAtomic: input.expectedAmountAtomic ?? null,
        payToMatch: null,
        amountMatch: null,
        exactTransferMatch: false
      },
      limitation:
        "No final Base receipt/transaction was available at verification time. Retry later if the transaction is still pending."
    } as const;
  }

  const receiptSucceeded = receipt.status === "0x1";
  const blockNumber = parseHex(receipt.blockNumber);
  const latestValue = await rpc("eth_blockNumber", []);
  const latestBlock = parseHex(latestValue);
  const confirmations =
    blockNumber !== null && latestBlock !== null && latestBlock >= blockNumber
      ? (latestBlock - blockNumber + 1n).toString()
      : null;

  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  const transfers = logs.flatMap((value) => {
    const log = object(value);
    if (!log || typeof log.address !== "string") return [];
    if (normalizeAddress(log.address) !== normalizeAddress(BASE_USDC)) return [];
    const topics = Array.isArray(log.topics) ? log.topics : [];
    if (String(topics[0] ?? "").toLowerCase() !== TRANSFER_TOPIC) return [];
    const from = topicAddress(topics[1]);
    const to = topicAddress(topics[2]);
    const amount = parseHex(log.data);
    if (!from || !to || amount === null) return [];
    return [{
      from,
      to,
      amountAtomic: amount.toString()
    }];
  });

  const txTo = typeof transaction.to === "string"
    ? transaction.to.toLowerCase()
    : null;
  const txInput = typeof transaction.input === "string"
    ? transaction.input.toLowerCase()
    : "";
  const functionSelector = /^0x[0-9a-f]{8}/.test(txInput)
    ? txInput.slice(0, 10)
    : null;
  const paymentShape =
    txTo === normalizeAddress(BASE_USDC) &&
    functionSelector !== null &&
    EIP3009_SELECTORS.has(functionSelector)
      ? "eip3009-exact"
      : "other";

  const expectedPayTo = input.expectedPayTo?.toLowerCase() ?? null;
  const expectedAmountAtomic = input.expectedAmountAtomic ?? null;
  const payToMatch = expectedPayTo === null
    ? null
    : transfers.some((transfer) => transfer.to === expectedPayTo);
  const amountMatch = expectedAmountAtomic === null
    ? null
    : transfers.some((transfer) => transfer.amountAtomic === expectedAmountAtomic);
  const exactTransferMatch = transfers.some((transfer) =>
    (expectedPayTo === null || transfer.to === expectedPayTo) &&
    (expectedAmountAtomic === null || transfer.amountAtomic === expectedAmountAtomic)
  );

  let verdict:
    | "verified"
    | "reverted"
    | "not_usdc_eip3009"
    | "expectation_mismatch";
  if (!receiptSucceeded) verdict = "reverted";
  else if (paymentShape !== "eip3009-exact" || transfers.length === 0) {
    verdict = "not_usdc_eip3009";
  } else if (!exactTransferMatch) verdict = "expectation_mismatch";
  else verdict = "verified";

  return {
    network: BASE_NETWORK,
    asset: BASE_USDC,
    txHash: input.txHash.toLowerCase(),
    found: true,
    settled: verdict === "verified",
    verdict,
    paymentShape,
    receiptStatus: receiptSucceeded ? "success" : "reverted",
    blockNumber: blockNumber?.toString() ?? null,
    confirmations,
    transactionTarget: txTo,
    functionSelector,
    transferCount: transfers.length,
    transfers,
    assertions: {
      expectedPayTo,
      expectedAmountAtomic,
      payToMatch,
      amountMatch,
      exactTransferMatch
    },
    limitation:
      "Verifies a Base USDC EIP-3009 settlement and optional transfer expectations at observation time. It does not establish provider identity, legitimacy, or fulfillment quality."
  } as const;
}
