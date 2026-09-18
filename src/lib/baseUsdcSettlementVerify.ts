const BASE_RPC = "https://mainnet.base.org";
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_NETWORK = "eip155:8453";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type BaseSettlementRpc = (
  method: string,
  params: unknown[]
) => Promise<unknown>;

async function defaultRpc(method: string, params: unknown[]) {
  const response = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) throw new Error(`Base RPC ${method} returned HTTP ${response.status}.`);
  const payload = await response.json() as { result?: unknown; error?: unknown };
  if (payload.error) throw new Error(`Base RPC ${method} failed.`);
  return payload.result ?? null;
}

function normalizeAddress(value: string, label: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} must be a 20-byte EVM address.`);
  }
  return value.toLowerCase();
}

function topicAddress(value: unknown) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
  return `0x${value.slice(-40).toLowerCase()}`;
}

function hexQuantity(value: unknown, label: string) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error(`Base RPC returned an invalid ${label}.`);
  }
  return BigInt(value);
}

export async function verifyBaseUsdcSettlement(
  input: {
    transactionHash: string;
    expectedPayTo?: string;
    expectedAmountAtomic?: string;
    minimumConfirmations?: number;
  },
  rpc: BaseSettlementRpc = defaultRpc
) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.transactionHash)) {
    throw new Error("transactionHash must be a 32-byte Base transaction hash.");
  }
  const expectedPayTo = input.expectedPayTo
    ? normalizeAddress(input.expectedPayTo, "expectedPayTo")
    : null;
  const expectedAmountAtomic = input.expectedAmountAtomic ?? null;
  if (expectedAmountAtomic !== null && (!/^\d+$/.test(expectedAmountAtomic) || BigInt(expectedAmountAtomic) <= 0n)) {
    throw new Error("expectedAmountAtomic must be a positive integer string.");
  }
  const minimumConfirmations = input.minimumConfirmations ?? 1;
  if (!Number.isInteger(minimumConfirmations) || minimumConfirmations < 1 || minimumConfirmations > 10_000) {
    throw new Error("minimumConfirmations must be an integer from 1 to 10000.");
  }

  const receipt = await rpc("eth_getTransactionReceipt", [input.transactionHash]) as {
    status?: unknown;
    blockNumber?: unknown;
    logs?: Array<{ address?: unknown; topics?: unknown[]; data?: unknown }>;
  } | null;

  if (!receipt) {
    return {
      network: BASE_NETWORK,
      asset: BASE_USDC,
      transactionHash: input.transactionHash,
      settlementVerified: false,
      reasonCodes: ["transaction_not_found_or_pending"],
      transactionSucceeded: false,
      confirmations: 0,
      minimumConfirmations,
      expectedPayTo,
      expectedAmountAtomic,
      observedAmountAtomic: "0",
      transfers: []
    };
  }

  const transactionSucceeded = receipt.status === "0x1";
  const blockNumber = hexQuantity(receipt.blockNumber, "receipt block number");
  const latestBlock = hexQuantity(await rpc("eth_blockNumber", []), "latest block number");
  const confirmations = latestBlock >= blockNumber
    ? Number(latestBlock - blockNumber + 1n)
    : 0;

  const transfers = [];
  for (const log of receipt.logs ?? []) {
    if (typeof log.address !== "string" || log.address.toLowerCase() !== BASE_USDC.toLowerCase()) continue;
    if (!Array.isArray(log.topics) || String(log.topics[0] ?? "").toLowerCase() !== TRANSFER_TOPIC) continue;
    const from = topicAddress(log.topics[1]);
    const to = topicAddress(log.topics[2]);
    if (!from || !to || typeof log.data !== "string" || !/^0x[0-9a-fA-F]+$/.test(log.data)) continue;
    transfers.push({
      from,
      to,
      amountAtomic: BigInt(log.data).toString()
    });
    if (transfers.length >= 32) break;
  }

  const relevant = expectedPayTo
    ? transfers.filter((transfer) => transfer.to === expectedPayTo)
    : transfers;
  const observedAmount = relevant.reduce(
    (sum, transfer) => sum + BigInt(transfer.amountAtomic),
    0n
  );

  const reasonCodes: string[] = [];
  if (!transactionSucceeded) reasonCodes.push("transaction_reverted");
  if (transfers.length === 0) reasonCodes.push("no_base_usdc_transfer");
  if (expectedPayTo && relevant.length === 0) reasonCodes.push("expected_payee_not_found");
  if (expectedAmountAtomic !== null && observedAmount !== BigInt(expectedAmountAtomic)) {
    reasonCodes.push("expected_amount_mismatch");
  }
  if (confirmations < minimumConfirmations) reasonCodes.push("insufficient_confirmations");

  return {
    network: BASE_NETWORK,
    asset: BASE_USDC,
    transactionHash: input.transactionHash,
    transactionSucceeded,
    blockNumber: blockNumber.toString(),
    latestBlockNumber: latestBlock.toString(),
    confirmations,
    minimumConfirmations,
    expectedPayTo,
    expectedAmountAtomic,
    observedAmountAtomic: observedAmount.toString(),
    transferCount: transfers.length,
    matchingTransferCount: relevant.length,
    transfers,
    settlementVerified: reasonCodes.length === 0,
    reasonCodes
  };
}
