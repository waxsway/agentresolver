import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const EVENT_NAME = "paid_capability_settled";
const FINGERPRINT_RE = /^[0-9a-f]{16}$/i;
const RESPONSE_DIGEST_RE = /^[0-9a-f]{64}$/i;
const COMMIT_RE = /^[0-9a-f]{40}$/i;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function parseJson(value) {
  if (typeof value !== "string") return asObject(value);
  try {
    return asObject(JSON.parse(value));
  } catch {
    return null;
  }
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
      const transactionFingerprint =
        typeof event.transactionFingerprint === "string"
          ? event.transactionFingerprint.toLowerCase()
          : typeof event.transactionHash === "string"
            ? event.transactionHash.toLowerCase()
            : null;

      if (!transactionFingerprint || !FINGERPRINT_RE.test(transactionFingerprint)) return null;

      const responseStatus = Number.isInteger(event.responseStatus)
        ? event.responseStatus
        : Number.isFinite(Number(event.responseStatus))
          ? Number(event.responseStatus)
          : null;

      const executionId =
        typeof event.executionId === "string" && event.executionId.length <= 80
          ? event.executionId
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
        typeof event.amount === "string" && event.amount.length <= 80
          ? event.amount
          : null;
      const observedAt =
        typeof event.at === "string" && !Number.isNaN(Date.parse(event.at))
          ? new Date(event.at).toISOString()
          : null;

      const deliveryEvidenceComplete =
        responseStatus !== null &&
        responseStatus >= 200 &&
        responseStatus < 300 &&
        Boolean(executionId && responseSha256 && deploymentCommitSha);

      return {
        eventId: sha256([
          "agentresolver-settlement-event-v1",
          network || "<unknown-network>",
          transactionFingerprint,
          capabilityId
        ].join("\n")),
        observedAt,
        capabilityId,
        network,
        amount,
        responseStatus,
        transactionFingerprint,
        executionId,
        responseSha256,
        deploymentCommitSha,
        deliveryEvidenceComplete
      };
    })
    .filter(Boolean);
}

function increment(map, key) {
  const safeKey = key || "unknown";
  map[safeKey] = (map[safeKey] || 0) + 1;
}

export function mergeSettlementHistory(current, incomingEvents, updatedAt = new Date().toISOString()) {
  const existing = Array.isArray(current?.settlements) ? current.settlements : [];
  const byId = new Map();
  const existingIds = new Set();

  for (const entry of existing) {
    if (entry && typeof entry.eventId === "string") {
      byId.set(entry.eventId, entry);
      existingIds.add(entry.eventId);
    }
  }

  const hasNewEvidence = incomingEvents.some(
    (entry) => entry && typeof entry.eventId === "string" && !existingIds.has(entry.eventId)
  );

  for (const entry of incomingEvents) {
    if (entry && typeof entry.eventId === "string") byId.set(entry.eventId, entry);
  }

  const settlements = [...byId.values()].sort((a, b) => {
    const aTime = a.observedAt || "";
    const bTime = b.observedAt || "";
    return aTime.localeCompare(bTime) || a.eventId.localeCompare(b.eventId);
  });

  const byNetwork = {};
  const byCapability = {};
  let successfulDeliveryCount = 0;
  let settledButNon2xxCount = 0;
  let settlementWithIncompleteDeliveryEvidenceCount = 0;

  for (const entry of settlements) {
    increment(byNetwork, entry.network);
    increment(byCapability, entry.capabilityId);
    const status = entry.responseStatus;
    if (Number.isInteger(status) && status >= 200 && status < 300) {
      if (entry.deliveryEvidenceComplete) successfulDeliveryCount += 1;
      else settlementWithIncompleteDeliveryEvidenceCount += 1;
    } else {
      settledButNon2xxCount += 1;
    }
  }

  return {
    schemaVersion: 1,
    service: "AgentResolver",
    canonicalOrigin: "https://agentresolver.vercel.app",
    evidenceType: "x402-settlement-evidence-history",
    sourceEvent: EVENT_NAME,
    interpretation:
      "First-party settlement telemetry versioned in public Git. This is evidence of x402 settlement responses observed by AgentResolver, not an independent reputation score or on-chain registry.",
    lastUpdatedAt: hasNewEvidence ? updatedAt : current?.lastUpdatedAt ?? null,
    settlementCount: settlements.length,
    successfulDeliveryCount,
    settledButNon2xxCount,
    settlementWithIncompleteDeliveryEvidenceCount,
    uniqueTransactionFingerprintCount: new Set(
      settlements.map((entry) => entry.transactionFingerprint).filter(Boolean)
    ).size,
    byNetwork,
    byCapability,
    settlements,
    privacy: {
      rawPayerAddressesPublished: false,
      payerFingerprintsPublished: false,
      rawTransactionIdsPublished: false,
      transactionFingerprintsPublished: true
    },
    verification: {
      transactionFingerprintAlgorithm: "first 16 hex characters of SHA-256(transaction id)",
      perCallSettlementEvidenceHeader: "payment-response",
      perCallResponseDigestHeader: "x-agentresolver-response-sha256",
      perCallExecutionIdHeader: "x-agentresolver-execution-id",
      perCallDeploymentHeader: "x-agentresolver-deployment"
    },
    limitations: [
      "Only paid_capability_settled runtime events are eligible for this history.",
      "The event is emitted only when x402 middleware reports success and supplies a transaction identifier.",
      "This file is versioned in public Git history but can still be changed by the repository owner; it is not immutable or independently operated.",
      "Transaction fingerprints preserve buyer privacy and are not sufficient for a third party to locate a payment on-chain without already knowing the transaction identifier.",
      "Crawls, registrations, 402 challenges, unsigned requests, and traffic volume are never counted as settlements.",
      "Successful delivery is counted separately from settlement and requires a 2xx response plus execution ID, response SHA-256, and deployment commit evidence."
    ]
  };
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (process.argv[1] && process.argv[1].endsWith("merge-settlement-history.mjs")) {
  const historyPath = arg("--history");
  const logsPath = arg("--logs");
  const outputPath = arg("--output");
  if (!historyPath || !logsPath || !outputPath) {
    throw new Error("Usage: node scripts/merge-settlement-history.mjs --history <file> --logs <file> --output <file>");
  }

  const history = JSON.parse(readFileSync(historyPath, "utf8"));
  const events = parseSettlementEventsFromText(readFileSync(logsPath, "utf8"));
  const merged = mergeSettlementHistory(history, events);
  writeFileSync(outputPath, JSON.stringify(merged, null, 2) + "\n");
  process.stdout.write(JSON.stringify({
    inputEventCount: events.length,
    settlementCount: merged.settlementCount,
    successfulDeliveryCount: merged.successfulDeliveryCount,
    settledButNon2xxCount: merged.settledButNon2xxCount
  }) + "\n");
}
