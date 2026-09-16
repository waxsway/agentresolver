import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const EVENT_NAME = "paid_capability_settled";
const BASE_NETWORK = "eip155:8453";
const SOLANA_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const BASE_RPC = "https://mainnet.base.org";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const BASE_PAY_TO = "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8";
const SOLANA_PAY_TO = "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const FINGERPRINT_RE = /^[0-9a-f]{16}$/i;
const RESPONSE_DIGEST_RE = /^[0-9a-f]{64}$/i;
const COMMIT_RE = /^[0-9a-f]{40}$/i;
const EXECUTION_ID_RE = /^[0-9a-f-]{36}$/i;
const BASE_TX_RE = /^0x[0-9a-f]{64}$/i;
const SOLANA_TX_RE = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function shortHash(value) {
  return sha256(value).slice(0, 16);
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function parseJson(value) {
  if (typeof value !== "string") return asObject(value);
  const trimmed = value.trim();
  const candidates = [trimmed];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      return asObject(JSON.parse(candidate));
    } catch {
      // Ignore non-JSON framing around a structured runtime log.
    }
  }
  return null;
}

function eventFromLogRecord(record) {
  const direct = parseJson(record);
  if (direct?.event === EVENT_NAME) return direct;

  const candidates = direct
    ? [direct.message, direct.text, direct.msg, direct.data]
    : [];

  for (const candidate of candidates) {
    const nested = parseJson(candidate);
    if (nested?.event === EVENT_NAME) return nested;
  }
  return null;
}

export function parseSettlementEventsFromText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];

  const whole = parseJson(trimmed);
  const records = Array.isArray(whole)
    ? whole
    : trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  return records
    .map(eventFromLogRecord)
    .filter(Boolean)
    .filter((event) => event.event === EVENT_NAME && event.success === true)
    .map((event) => {
      const transactionReference =
        typeof event.transactionReference === "string" &&
        event.transactionReference.length <= 200
          ? event.transactionReference
          : null;
      const transactionFingerprint =
        typeof event.transactionFingerprint === "string" &&
        FINGERPRINT_RE.test(event.transactionFingerprint)
          ? event.transactionFingerprint.toLowerCase()
          : typeof event.transactionHash === "string" &&
              FINGERPRINT_RE.test(event.transactionHash)
            ? event.transactionHash.toLowerCase()
            : transactionReference
              ? shortHash(transactionReference)
              : null;

      if (!transactionFingerprint) return null;

      const responseStatus = Number.isInteger(event.responseStatus)
        ? event.responseStatus
        : Number.isFinite(Number(event.responseStatus))
          ? Number(event.responseStatus)
          : null;

      const executionId =
        typeof event.executionId === "string" && EXECUTION_ID_RE.test(event.executionId)
          ? event.executionId.toLowerCase()
          : null;
      const responseSha256 =
        typeof event.responseSha256 === "string" && RESPONSE_DIGEST_RE.test(event.responseSha256)
          ? event.responseSha256.toLowerCase()
          : null;
      const deploymentCommitSha =
        typeof event.deploymentCommitSha === "string" && COMMIT_RE.test(event.deploymentCommitSha)
          ? event.deploymentCommitSha.toLowerCase()
          : null;
      const network =
        typeof event.network === "string" && event.network.length <= 80
          ? event.network
          : null;
      const capabilityId =
        typeof event.capabilityId === "string" && event.capabilityId.length <= 120
          ? event.capabilityId
          : "unknown";
      const amount =
        typeof event.amount === "string" && /^\d+$/.test(event.amount) && BigInt(event.amount) > 0n
          ? event.amount
          : null;
      const observedAt =
        typeof event.at === "string" && !Number.isNaN(Date.parse(event.at))
          ? new Date(event.at).toISOString()
          : null;
      const payerHash =
        typeof event.payerHash === "string" && FINGERPRINT_RE.test(event.payerHash)
          ? event.payerHash.toLowerCase()
          : null;

      const deliveryEvidenceComplete =
        responseStatus !== null &&
        responseStatus >= 200 &&
        responseStatus < 300 &&
        Boolean(executionId && responseSha256 && deploymentCommitSha);

      return {
        eventId: sha256([
          "agentresolver-settlement-event-v2",
          network || "<unknown-network>",
          transactionReference || transactionFingerprint,
          capabilityId
        ].join("\n")),
        observedAt,
        capabilityId,
        network,
        amount,
        responseStatus,
        transactionFingerprint,
        transactionReference,
        payerHash,
        executionId,
        responseSha256,
        deploymentCommitSha,
        deliveryEvidenceComplete
      };
    })
    .filter(Boolean);
}

async function defaultRpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) {
    throw new Error(`RPC ${method} returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.error) {
    throw new Error(`RPC ${method} failed: ${JSON.stringify(payload.error)}`);
  }
  return payload?.result ?? null;
}

function defaultCommitExists(sha) {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function timeCloseEnough(blockTimeSeconds, observedAt) {
  if (!Number.isFinite(Number(blockTimeSeconds)) || !observedAt) return false;
  const blockMs = Number(blockTimeSeconds) * 1000;
  const observedMs = Date.parse(observedAt);
  return Number.isFinite(observedMs) &&
    Math.abs(observedMs - blockMs) <= 2 * 60 * 60 * 1000;
}

function basePayToTopic() {
  return `0x${BASE_PAY_TO.slice(2).toLowerCase().padStart(64, "0")}`;
}

async function verifyBase(event, rpc) {
  if (!event.transactionReference || !BASE_TX_RE.test(event.transactionReference)) return null;
  const receipt = await rpc(BASE_RPC, "eth_getTransactionReceipt", [
    event.transactionReference
  ]);
  if (!receipt || receipt.status !== "0x1" || !receipt.blockNumber) return null;

  let observed = 0n;
  for (const log of receipt.logs ?? []) {
    if (String(log.address).toLowerCase() !== BASE_USDC.toLowerCase()) continue;
    if (String(log.topics?.[0]).toLowerCase() !== TRANSFER_TOPIC) continue;
    if (String(log.topics?.[2]).toLowerCase() !== basePayToTopic()) continue;
    try {
      observed += BigInt(log.data);
    } catch {
      // Ignore malformed log data rather than treating it as payment evidence.
    }
  }

  if (observed <= 0n) return null;
  if (event.amount !== null && observed !== BigInt(event.amount)) return null;

  const block = await rpc(BASE_RPC, "eth_getBlockByNumber", [
    receipt.blockNumber,
    false
  ]);
  if (!block?.timestamp) return null;
  const blockTimeSeconds = Number(BigInt(block.timestamp));
  if (!timeCloseEnough(blockTimeSeconds, event.observedAt)) return null;

  return {
    verified: true,
    method: "base-usdc-transfer-log",
    network: BASE_NETWORK,
    asset: BASE_USDC,
    payTo: BASE_PAY_TO,
    blockReference: receipt.blockNumber,
    blockTime: new Date(blockTimeSeconds * 1000).toISOString(),
    observedTransferAmountAtomic: observed.toString()
  };
}

function tokenAmountByOwner(items, owner) {
  let amount = 0n;
  for (const item of items ?? []) {
    if (item?.mint !== SOLANA_USDC || item?.owner !== owner) continue;
    const raw = item?.uiTokenAmount?.amount;
    if (typeof raw === "string" && /^\d+$/.test(raw)) amount += BigInt(raw);
  }
  return amount;
}

async function verifySolana(event, rpc) {
  if (!event.transactionReference || !SOLANA_TX_RE.test(event.transactionReference)) return null;
  const tx = await rpc(SOLANA_RPC, "getTransaction", [
    event.transactionReference,
    {
      encoding: "jsonParsed",
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    }
  ]);
  if (!tx || tx.meta?.err || !Number.isFinite(Number(tx.blockTime))) return null;

  const pre = tokenAmountByOwner(tx.meta?.preTokenBalances, SOLANA_PAY_TO);
  const post = tokenAmountByOwner(tx.meta?.postTokenBalances, SOLANA_PAY_TO);
  const observed = post - pre;
  if (observed <= 0n) return null;
  if (event.amount !== null && observed !== BigInt(event.amount)) return null;
  if (!timeCloseEnough(tx.blockTime, event.observedAt)) return null;

  return {
    verified: true,
    method: "solana-usdc-token-balance-delta",
    network: SOLANA_NETWORK,
    asset: SOLANA_USDC,
    payTo: SOLANA_PAY_TO,
    blockReference: String(tx.slot),
    blockTime: new Date(Number(tx.blockTime) * 1000).toISOString(),
    observedTransferAmountAtomic: observed.toString()
  };
}

function publicSettlement(event, onchainVerification, verifiedAt) {
  return {
    eventId: event.eventId,
    observedAt: event.observedAt,
    verifiedAt,
    capabilityId: event.capabilityId,
    network: event.network,
    amount: event.amount,
    responseStatus: event.responseStatus,
    transactionFingerprint: event.transactionFingerprint,
    transactionReference: event.transactionReference,
    executionId: event.executionId,
    responseSha256: event.responseSha256,
    deploymentCommitSha: event.deploymentCommitSha,
    deliveryEvidenceComplete: event.deliveryEvidenceComplete,
    onchainVerification
  };
}

export async function verifySettlementEvent(
  event,
  {
    rpc = defaultRpc,
    commitExists = defaultCommitExists,
    verifiedAt = new Date().toISOString()
  } = {}
) {
  if (!event?.transactionReference) return null;
  if (!event.deploymentCommitSha || !commitExists(event.deploymentCommitSha)) return null;

  let onchainVerification = null;
  if (event.network === BASE_NETWORK) onchainVerification = await verifyBase(event, rpc);
  else if (event.network === SOLANA_NETWORK) onchainVerification = await verifySolana(event, rpc);
  else return null;

  return onchainVerification
    ? publicSettlement(event, onchainVerification, verifiedAt)
    : null;
}

function increment(map, key) {
  const safeKey = key || "unknown";
  map[safeKey] = (map[safeKey] || 0) + 1;
}

function independentlyVerified(entry) {
  return entry?.onchainVerification?.verified === true &&
    typeof entry?.transactionReference === "string" &&
    entry.transactionReference.length > 0;
}

export function mergeSettlementHistory(current, incomingEvents, updatedAt = new Date().toISOString()) {
  const existing = Array.isArray(current?.settlements) ? current.settlements : [];
  const byId = new Map();
  for (const entry of existing) {
    if (entry && typeof entry.eventId === "string") byId.set(entry.eventId, entry);
  }

  let hasNewEvidence = false;
  for (const entry of incomingEvents) {
    if (!entry || typeof entry.eventId !== "string") continue;
    const prior = byId.get(entry.eventId);
    if (!prior || (!independentlyVerified(prior) && independentlyVerified(entry))) {
      byId.set(entry.eventId, entry);
      hasNewEvidence = true;
    }
  }

  const settlements = [...byId.values()].sort((a, b) => {
    const aTime = a.observedAt || "";
    const bTime = b.observedAt || "";
    return aTime.localeCompare(bTime) || a.eventId.localeCompare(b.eventId);
  });

  const byNetwork = {};
  const byCapability = {};
  const verifiedAmountsByNetwork = {};
  let independentlyVerifiedSettlementCount = 0;
  let successfulVerifiedExecutionCount = 0;
  let verifiedButNon2xxOrIncompleteCount = 0;
  let unverifiedLegacySettlementCount = 0;

  for (const entry of settlements) {
    if (!independentlyVerified(entry)) {
      unverifiedLegacySettlementCount += 1;
      continue;
    }

    independentlyVerifiedSettlementCount += 1;
    increment(byNetwork, entry.network);
    increment(byCapability, entry.capabilityId);

    const amount = entry.onchainVerification?.observedTransferAmountAtomic;
    if (typeof amount === "string" && /^\d+$/.test(amount)) {
      verifiedAmountsByNetwork[entry.network] =
        (BigInt(verifiedAmountsByNetwork[entry.network] || "0") + BigInt(amount)).toString();
    }

    const status = entry.responseStatus;
    if (
      Number.isInteger(status) &&
      status >= 200 &&
      status < 300 &&
      entry.deliveryEvidenceComplete
    ) {
      successfulVerifiedExecutionCount += 1;
    } else {
      verifiedButNon2xxOrIncompleteCount += 1;
    }
  }

  const verified = settlements.filter(independentlyVerified);
  return {
    schemaVersion: 2,
    service: "AgentResolver",
    canonicalOrigin: "https://agentresolver.vercel.app",
    evidenceType: "independently-verifiable-x402-settlement-history",
    sourceEvent: EVENT_NAME,
    interpretation:
      "Successful x402 settlement telemetry is admitted only after an independent public-chain check confirms a USDC transfer to AgentResolver on the stated network. This is verifiable usage history, not a synthetic reputation score.",
    lastUpdatedAt: hasNewEvidence ? updatedAt : current?.lastUpdatedAt ?? null,
    settlementCount: settlements.length,
    independentlyVerifiedSettlementCount,
    successfulVerifiedExecutionCount,
    verifiedButNon2xxOrIncompleteCount,
    unverifiedLegacySettlementCount,
    firstVerifiedSettlementAt: verified[0]?.observedAt ?? null,
    latestVerifiedSettlementAt: verified.at(-1)?.observedAt ?? null,
    uniqueVerifiedTransactionCount: new Set(
      verified.map((entry) => entry.transactionReference).filter(Boolean)
    ).size,
    byNetwork,
    byCapability,
    verifiedAmountsByNetwork,
    settlements,
    privacy: {
      rawPayerAddressesPublished: false,
      payerFingerprintsPublished: false,
      rawTransactionIdsPublished: true,
      rationale:
        "Transaction identifiers are public-chain references required for independent settlement verification; payer identity is not republished by this history."
    },
    verification: {
      independentOnchainVerificationRequired: true,
      deploymentCommitMustExistInRepositoryHistory: true,
      eventMustBe: EVENT_NAME,
      base: {
        network: BASE_NETWORK,
        asset: BASE_USDC,
        payTo: BASE_PAY_TO,
        method: "successful transaction receipt plus exact USDC Transfer amount to payTo"
      },
      solana: {
        network: SOLANA_NETWORK,
        asset: SOLANA_USDC,
        payTo: SOLANA_PAY_TO,
        method: "successful transaction plus exact USDC token-balance increase for payTo owner"
      },
      maxSettlementToBlockTimeDifferenceSeconds: 7200,
      perCallSettlementEvidenceHeader: "payment-response",
      perCallResponseDigestHeader: "x-agentresolver-response-sha256",
      perCallExecutionIdHeader: "x-agentresolver-execution-id",
      perCallDeploymentHeader: "x-agentresolver-deployment"
    },
    exclusions: {
      crawls: true,
      registrations: true,
      paymentChallenges402: true,
      unsignedRequests: true,
      trafficVolume: true,
      unverifiedPaymentAttempts: true,
      syntheticTrustScore: true
    },
    limitations: [
      "AgentResolver runtime telemetry selects candidate settlements; the payment itself is then checked independently against public-chain data before it can increase independentlyVerifiedSettlementCount.",
      "The Git history is operated by the repository owner and is not immutable, but every published verified transaction reference can be rechecked independently on its network.",
      "A verified past settlement and successful delivery do not prove third-party provider legitimacy or guarantee future behavior or fulfillment.",
      "Older first-party entries lacking a public transaction reference, if any, remain visible as unverifiedLegacySettlementCount and never increase independently verified counts."
    ]
  };
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function makeBaseTestRpc(event, wrongPayTo = false) {
  return async (_url, method) => {
    if (method === "eth_getTransactionReceipt") {
      const topic = wrongPayTo
        ? `0x${"22".repeat(32)}`
        : basePayToTopic();
      return {
        status: "0x1",
        blockNumber: "0x10",
        logs: [{
          address: BASE_USDC,
          topics: [TRANSFER_TOPIC, `0x${"11".repeat(32)}`, topic],
          data: "0x3e8"
        }]
      };
    }
    if (method === "eth_getBlockByNumber") {
      return { timestamp: `0x${Math.floor(Date.parse(event.observedAt) / 1000).toString(16)}` };
    }
    throw new Error(`Unexpected Base self-test method ${method}`);
  };
}

function makeSolanaTestRpc(event) {
  return async (_url, method) => {
    if (method !== "getTransaction") throw new Error(`Unexpected Solana self-test method ${method}`);
    return {
      slot: 123,
      blockTime: Math.floor(Date.parse(event.observedAt) / 1000),
      meta: {
        err: null,
        preTokenBalances: [{
          mint: SOLANA_USDC,
          owner: SOLANA_PAY_TO,
          uiTokenAmount: { amount: "0" }
        }],
        postTokenBalances: [{
          mint: SOLANA_USDC,
          owner: SOLANA_PAY_TO,
          uiTokenAmount: { amount: "1000" }
        }]
      }
    };
  };
}

async function selfTest() {
  const baseTx = `0x${"ab".repeat(32)}`;
  const rawBase = {
    event: EVENT_NAME,
    at: "2026-09-16T20:00:00.000Z",
    capabilityId: "x402-ping",
    responseStatus: 200,
    success: true,
    network: BASE_NETWORK,
    amount: "1000",
    transactionReference: baseTx,
    transactionFingerprint: shortHash(baseTx),
    payerHash: "1234567890abcdef",
    executionId: "11111111-1111-4111-8111-111111111111",
    responseSha256: "a".repeat(64),
    deploymentCommitSha: "b".repeat(40)
  };

  const parsed = parseSettlementEventsFromText(
    [
      JSON.stringify({ message: JSON.stringify(rawBase) }),
      JSON.stringify({ event: "paid_capability_attempt", success: true })
    ].join("\n")
  );
  if (parsed.length !== 1) throw new Error("self-test failed: settlement parser boundary");
  if (parsed[0].transactionReference !== baseTx) {
    throw new Error("self-test failed: public transaction reference was not preserved");
  }

  const verifiedBase = await verifySettlementEvent(parsed[0], {
    rpc: makeBaseTestRpc(parsed[0]),
    commitExists: () => true,
    verifiedAt: "2026-09-16T20:01:00.000Z"
  });
  if (!verifiedBase?.onchainVerification?.verified) {
    throw new Error("self-test failed: valid Base USDC settlement was not verified");
  }
  if ("payerHash" in verifiedBase || "payer" in verifiedBase) {
    throw new Error("self-test failed: payer identity leaked into public history");
  }

  const rejectedBase = await verifySettlementEvent(parsed[0], {
    rpc: makeBaseTestRpc(parsed[0], true),
    commitExists: () => true
  });
  if (rejectedBase !== null) {
    throw new Error("self-test failed: wrong Base payTo was accepted");
  }

  const solTx = "3".repeat(88);
  const parsedSolana = parseSettlementEventsFromText(JSON.stringify({
    ...rawBase,
    network: SOLANA_NETWORK,
    transactionReference: solTx,
    transactionFingerprint: shortHash(solTx),
    deploymentCommitSha: "c".repeat(40)
  }))[0];
  const verifiedSolana = await verifySettlementEvent(parsedSolana, {
    rpc: makeSolanaTestRpc(parsedSolana),
    commitExists: () => true,
    verifiedAt: "2026-09-16T20:02:00.000Z"
  });
  if (!verifiedSolana?.onchainVerification?.verified) {
    throw new Error("self-test failed: valid Solana USDC settlement was not verified");
  }

  const first = mergeSettlementHistory(
    { schemaVersion: 1, settlements: [] },
    [verifiedBase, verifiedSolana],
    "2026-09-16T20:03:00.000Z"
  );
  if (
    first.schemaVersion !== 2 ||
    first.independentlyVerifiedSettlementCount !== 2 ||
    first.successfulVerifiedExecutionCount !== 2 ||
    first.privacy.rawPayerAddressesPublished !== false ||
    first.privacy.rawTransactionIdsPublished !== true ||
    first.exclusions.syntheticTrustScore !== true
  ) {
    throw new Error("self-test failed: aggregate invariants");
  }

  const second = mergeSettlementHistory(
    first,
    [verifiedBase],
    "2026-09-16T21:03:00.000Z"
  );
  if (
    second.independentlyVerifiedSettlementCount !== 2 ||
    second.lastUpdatedAt !== first.lastUpdatedAt
  ) {
    throw new Error("self-test failed: overlapping windows are not idempotent");
  }

  process.stdout.write("settlement-history on-chain verifier self-test PASSED\n");
}

async function main() {
  if (process.argv.includes("--self-test")) {
    await selfTest();
    return;
  }

  const historyPath = arg("--history");
  const logsPath = arg("--logs");
  const outputPath = arg("--output");
  if (!historyPath || !logsPath || !outputPath) {
    throw new Error(
      "Usage: node scripts/merge-settlement-history.mjs --history <file> --logs <file> --output <file>"
    );
  }

  const current = JSON.parse(readFileSync(historyPath, "utf8"));
  const candidates = parseSettlementEventsFromText(readFileSync(logsPath, "utf8"));
  const verified = [];

  for (const candidate of candidates) {
    const alreadyVerified = (current?.settlements ?? []).some(
      (entry) => entry?.eventId === candidate.eventId && independentlyVerified(entry)
    );
    if (alreadyVerified) continue;

    const result = await verifySettlementEvent(candidate);
    if (result) {
      verified.push(result);
    } else if (candidate.transactionReference) {
      process.stderr.write(
        `Rejected unverified settlement candidate ${candidate.network || "unknown"}:${candidate.transactionFingerprint}\n`
      );
    }
  }

  const merged = mergeSettlementHistory(current, verified);
  writeFileSync(outputPath, JSON.stringify(merged, null, 2) + "\n");
  process.stdout.write(JSON.stringify({
    inputCandidateCount: candidates.length,
    newlyVerifiedCount: verified.length,
    settlementCount: merged.settlementCount,
    independentlyVerifiedSettlementCount: merged.independentlyVerifiedSettlementCount,
    successfulVerifiedExecutionCount: merged.successfulVerifiedExecutionCount
  }) + "\n");
}

if (process.argv[1] && process.argv[1].endsWith("merge-settlement-history.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
