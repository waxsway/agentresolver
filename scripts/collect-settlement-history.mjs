#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

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

const LEDGER_PATH = "history/verified-settlements.jsonl";
const AGGREGATE_PATH = "history/agentresolver-reputation.json";
const LEDGER_URL =
  "https://raw.githubusercontent.com/waxsway/agentresolver/settlement-history/history/verified-settlements.jsonl";
const REPO = "waxsway/agentresolver";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function stripEntryHash(entry) {
  const { entryHash: _ignored, ...rest } = entry;
  return rest;
}

function parseEmbeddedJson(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const candidates = [trimmed];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // Ignore non-JSON log framing.
    }
  }
  return null;
}

function candidateFromLogRecord(record) {
  const event =
    record?.event === "paid_capability_settled"
      ? record
      : parseEmbeddedJson(record?.message) ??
        parseEmbeddedJson(record?.text) ??
        parseEmbeddedJson(record?.msg);
  if (!event || event.event !== "paid_capability_settled") return null;
  if (event.success !== true) return null;
  if (![BASE_NETWORK, SOLANA_NETWORK].includes(event.network)) return null;
  if (typeof event.transactionReference !== "string" || !event.transactionReference) return null;
  if (typeof event.capabilityId !== "string" || !event.capabilityId) return null;
  if (typeof event.executionId !== "string" || !/^[0-9a-f-]{36}$/i.test(event.executionId)) return null;
  if (typeof event.responseSha256 !== "string" || !/^[0-9a-f]{64}$/i.test(event.responseSha256)) return null;
  if (typeof event.deploymentCommitSha !== "string" || !/^[0-9a-f]{40}$/i.test(event.deploymentCommitSha)) return null;
  if (
    event.payerHash !== null &&
    event.payerHash !== undefined &&
    (typeof event.payerHash !== "string" || !/^[0-9a-f]{16}$/i.test(event.payerHash))
  ) return null;
  if (typeof event.amount !== "string" || !/^\d+$/.test(event.amount) || BigInt(event.amount) <= 0n) return null;
  const settledAtMs = Date.parse(event.at);
  if (!Number.isFinite(settledAtMs)) return null;
  return {
    at: new Date(settledAtMs).toISOString(),
    capabilityId: event.capabilityId,
    network: event.network,
    amount: event.amount,
    transactionReference: event.transactionReference,
    payerHash: typeof event.payerHash === "string" ? event.payerHash.toLowerCase() : null,
    executionId: event.executionId.toLowerCase(),
    responseSha256: event.responseSha256.toLowerCase(),
    deploymentCommitSha: event.deploymentCommitSha.toLowerCase()
  };
}

function parseLogFile(path) {
  const raw = readFileSync(path, "utf8");
  const candidates = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      record = { message: line };
    }
    const candidate = candidateFromLogRecord(record);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function loadLedger() {
  const raw = readFileSync(LEDGER_PATH, "utf8");
  const entries = raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  let previous = null;
  for (const entry of entries) {
    if (entry.previousEntryHash !== previous) {
      throw new Error("Settlement history hash chain is broken.");
    }
    const expected = sha256(canonicalStringify(stripEntryHash(entry)));
    if (entry.entryHash !== expected) {
      throw new Error("Settlement history entry hash mismatch.");
    }
    previous = entry.entryHash;
  }
  return entries;
}

function deploymentCommitExists(sha) {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

async function rpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`RPC ${method} returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`RPC ${method} failed: ${JSON.stringify(payload.error)}`);
  return payload.result;
}

function timeCloseEnough(blockTimeSeconds, settledAt) {
  if (!Number.isFinite(blockTimeSeconds)) return false;
  const blockMs = Number(blockTimeSeconds) * 1000;
  const settledMs = Date.parse(settledAt);
  return Math.abs(settledMs - blockMs) <= 2 * 60 * 60 * 1000;
}

async function verifyBase(candidate) {
  if (!/^0x[0-9a-f]{64}$/i.test(candidate.transactionReference)) return null;
  const receipt = await rpc(BASE_RPC, "eth_getTransactionReceipt", [
    candidate.transactionReference
  ]);
  if (!receipt || receipt.status !== "0x1" || !receipt.blockNumber) return null;

  const payToTopic = `0x${BASE_PAY_TO.slice(2).toLowerCase().padStart(64, "0")}`;
  let matchingTransfer = null;
  for (const log of receipt.logs ?? []) {
    if (String(log.address).toLowerCase() !== BASE_USDC.toLowerCase()) continue;
    if (String(log.topics?.[0]).toLowerCase() !== TRANSFER_TOPIC) continue;
    if (String(log.topics?.[2]).toLowerCase() !== payToTopic) continue;
    let amount;
    try {
      amount = BigInt(log.data);
    } catch {
      continue;
    }
    if (amount >= BigInt(candidate.amount)) {
      matchingTransfer = amount;
      break;
    }
  }
  if (matchingTransfer === null) return null;

  const block = await rpc(BASE_RPC, "eth_getBlockByNumber", [
    receipt.blockNumber,
    false
  ]);
  if (!block?.timestamp) return null;
  const blockTime = Number(BigInt(block.timestamp));
  if (!timeCloseEnough(blockTime, candidate.at)) return null;

  return {
    method: "base-usdc-transfer-log",
    chainStatus: "confirmed",
    blockReference: receipt.blockNumber,
    blockTime: new Date(blockTime * 1000).toISOString(),
    observedTransferAmountAtomic: matchingTransfer.toString()
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

async function verifySolana(candidate) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(candidate.transactionReference)) return null;
  const tx = await rpc(SOLANA_RPC, "getTransaction", [
    candidate.transactionReference,
    {
      encoding: "jsonParsed",
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    }
  ]);
  if (!tx || tx.meta?.err) return null;

  const pre = tokenAmountByOwner(tx.meta?.preTokenBalances, SOLANA_PAY_TO);
  const post = tokenAmountByOwner(tx.meta?.postTokenBalances, SOLANA_PAY_TO);
  const delta = post - pre;
  if (delta < BigInt(candidate.amount)) return null;
  if (!timeCloseEnough(tx.blockTime, candidate.at)) return null;

  return {
    method: "solana-usdc-token-balance-delta",
    chainStatus: "confirmed",
    blockReference: String(tx.slot),
    blockTime: new Date(Number(tx.blockTime) * 1000).toISOString(),
    observedTransferAmountAtomic: delta.toString()
  };
}

async function independentlyVerify(candidate) {
  if (!deploymentCommitExists(candidate.deploymentCommitSha)) {
    throw new Error(
      `Refusing settlement ${candidate.transactionReference}: deployment commit is not present in repository history.`
    );
  }
  if (candidate.network === BASE_NETWORK) return verifyBase(candidate);
  if (candidate.network === SOLANA_NETWORK) return verifySolana(candidate);
  return null;
}

function makeEntry(candidate, verification, previousEntryHash) {
  const core = {
    schemaVersion: 1,
    settledAt: candidate.at,
    verifiedAt: new Date().toISOString(),
    capabilityId: candidate.capabilityId,
    network: candidate.network,
    amountAtomic: candidate.amount,
    asset: candidate.network === BASE_NETWORK ? BASE_USDC : SOLANA_USDC,
    payTo: candidate.network === BASE_NETWORK ? BASE_PAY_TO : SOLANA_PAY_TO,
    transactionReference: candidate.transactionReference,
    payerHash: candidate.payerHash,
    executionId: candidate.executionId,
    responseSha256: candidate.responseSha256,
    deploymentCommitSha: candidate.deploymentCommitSha,
    sourceEventHash: sha256(canonicalStringify(candidate)),
    verification: {
      ...verification,
      independentOnchainVerification: true
    },
    previousEntryHash
  };
  return {
    ...core,
    entryHash: sha256(canonicalStringify(core))
  };
}

function buildAggregate(entries) {
  const uniquePayers = new Set(entries.map((entry) => entry.payerHash).filter(Boolean));
  const networks = new Map();
  for (const entry of entries) {
    const current = networks.get(entry.network) ?? { count: 0, totalAmountAtomic: 0n };
    current.count += 1;
    current.totalAmountAtomic += BigInt(entry.amountAtomic);
    networks.set(entry.network, current);
  }

  return {
    schemaVersion: 1,
    service: "AgentResolver",
    model: "verified-settlement-history",
    generatedAt: new Date().toISOString(),
    verifiedSuccessfulSettlements: entries.length,
    successfulExecutionCount: entries.length,
    uniquePayerCount: uniquePayers.size,
    firstVerifiedSettlementAt: entries[0]?.settledAt ?? null,
    latestVerifiedSettlementAt: entries.at(-1)?.settledAt ?? null,
    networks: [...networks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([network, value]) => ({
        network,
        verifiedSuccessfulSettlements: value.count,
        totalAmountAtomic: value.totalAmountAtomic.toString()
      })),
    deploymentCommitShas: [...new Set(entries.map((entry) => entry.deploymentCommitSha))].sort(),
    headEntryHash: entries.at(-1)?.entryHash ?? null,
    ledgerUrl: LEDGER_URL,
    methodology: {
      source: "Vercel runtime settlement telemetry",
      requiresSuccessfulX402Receipt: true,
      requiresExecutionId: true,
      requiresResponseSha256: true,
      requiresDeploymentCommitSha: true,
      requiresIndependentOnchainVerification: true,
      countsCrawls: false,
      counts402Challenges: false,
      countsDirectoryRegistrations: false,
      countsUnsignedTraffic: false,
      syntheticTrustScore: false
    },
    limitations: [
      "This history proves independently verified AgentResolver payment settlements and associated execution evidence; it does not prove third-party provider legitimacy.",
      "Unique payer count uses a one-way hashed payer identifier from settlement telemetry and should not be treated as a verified real-world identity count.",
      "A successful past settlement does not guarantee future behavior or fulfillment."
    ]
  };
}

function selfTest() {
  const candidate = candidateFromLogRecord({
    message: JSON.stringify({
      event: "paid_capability_settled",
      at: "2026-09-16T19:45:00.000Z",
      capabilityId: "x402-ping",
      success: true,
      network: BASE_NETWORK,
      amount: "1000",
      transactionReference: `0x${"ab".repeat(32)}`,
      payerHash: "1234567890abcdef",
      executionId: "11111111-1111-4111-8111-111111111111",
      responseSha256: "cd".repeat(32),
      deploymentCommitSha: "ef".repeat(20)
    })
  });
  if (!candidate) throw new Error("candidate parser rejected valid settlement telemetry");
  if (
    candidateFromLogRecord({
      message: JSON.stringify({
        event: "paid_capability_attempt",
        success: true,
        transactionReference: `0x${"ab".repeat(32)}`
      })
    }) !== null
  ) {
    throw new Error("non-settlement event was accepted");
  }

  const first = makeEntry(
    candidate,
    {
      method: "self-test",
      chainStatus: "confirmed",
      blockReference: "1",
      blockTime: candidate.at,
      observedTransferAmountAtomic: "1000"
    },
    null
  );
  if (first.entryHash !== sha256(canonicalStringify(stripEntryHash(first)))) {
    throw new Error("entry hash is not deterministic");
  }
  const aggregate = buildAggregate([first]);
  if (
    aggregate.verifiedSuccessfulSettlements !== 1 ||
    aggregate.uniquePayerCount !== 1 ||
    aggregate.methodology.syntheticTrustScore !== false
  ) {
    throw new Error("aggregate invariants failed");
  }
  process.stdout.write("settlement-history self-test PASSED\n");
}

async function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const logsIndex = process.argv.indexOf("--logs");
  const logsPath = logsIndex >= 0 ? process.argv[logsIndex + 1] : null;
  if (!logsPath) throw new Error("Usage: collect-settlement-history.mjs --logs <ndjson-path>");

  const entries = loadLedger();
  const seen = new Set(entries.map((entry) => `${entry.network}:${entry.transactionReference}`));
  const candidates = parseLogFile(logsPath).sort(
    (a, b) =>
      a.at.localeCompare(b.at) ||
      a.network.localeCompare(b.network) ||
      a.transactionReference.localeCompare(b.transactionReference)
  );

  let appended = 0;
  for (const candidate of candidates) {
    const key = `${candidate.network}:${candidate.transactionReference}`;
    if (seen.has(key)) continue;

    let verification = null;
    try {
      verification = await independentlyVerify(candidate);
    } catch (error) {
      console.error(
        `Verification deferred for ${candidate.transactionReference}: ${error instanceof Error ? error.message : String(error)}`
      );
      continue;
    }
    if (!verification) {
      console.error(
        `Verification rejected for ${candidate.network} transaction ${candidate.transactionReference}.`
      );
      continue;
    }

    const entry = makeEntry(candidate, verification, entries.at(-1)?.entryHash ?? null);
    entries.push(entry);
    seen.add(key);
    appended += 1;
  }

  if (appended === 0) {
    process.stdout.write("No new independently verified settlements.\n");
    return;
  }

  writeFileSync(
    LEDGER_PATH,
    entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
    "utf8"
  );
  writeFileSync(
    AGGREGATE_PATH,
    JSON.stringify(buildAggregate(entries), null, 2) + "\n",
    "utf8"
  );
  process.stdout.write(`Appended ${appended} independently verified settlement(s).\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
