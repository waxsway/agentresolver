import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const SCRIPT = "scripts/merge-settlement-history.mjs";

function runMerge(logLines: string, history: Record<string, unknown> = { settlements: [] }) {
  const dir = mkdtempSync(join(tmpdir(), "agentresolver-settlement-history-"));
  const historyPath = join(dir, "history.json");
  const logsPath = join(dir, "logs.jsonl");
  const outputPath = join(dir, "output.json");
  writeFileSync(historyPath, JSON.stringify(history));
  writeFileSync(logsPath, logLines);

  const result = spawnSync(
    process.execPath,
    [SCRIPT, "--history", historyPath, "--logs", logsPath, "--output", outputPath],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(readFileSync(outputPath, "utf8")) as any;
}

test("settlement history admits only confirmed settlement events", () => {
  const confirmed = {
    event: "paid_capability_settled",
    at: "2026-09-16T20:00:00.000Z",
    capabilityId: "x402-ping",
    responseStatus: 200,
    success: true,
    network: "eip155:8453",
    amount: "1000",
    transactionFingerprint: "0123456789abcdef",
    payerHash: "should-not-be-published",
    executionId: "11111111-1111-4111-8111-111111111111",
    responseSha256: "a".repeat(64),
    deploymentCommitSha: "b".repeat(40)
  };
  const challenge = {
    event: "paid_capability_attempt",
    capabilityId: "x402-ping",
    success: true,
    transactionFingerprint: "ffffffffffffffff"
  };
  const unconfirmed = {
    event: "paid_capability_settlement_unconfirmed",
    capabilityId: "x402-ping",
    success: true,
    transactionFingerprint: "eeeeeeeeeeeeeeee"
  };

  const logs = [
    JSON.stringify({ message: JSON.stringify(confirmed) }),
    JSON.stringify(challenge),
    JSON.stringify({ text: JSON.stringify(unconfirmed) })
  ].join("\n");

  const history = runMerge(logs);
  assert.equal(history.settlementCount, 1);
  assert.equal(history.successfulDeliveryCount, 1);
  assert.equal(history.settledButNon2xxCount, 0);
  assert.equal(history.settlements[0].transactionFingerprint, "0123456789abcdef");
  assert.equal("payerHash" in history.settlements[0], false);
  assert.equal("payer" in history.settlements[0], false);
});

test("settled non-2xx responses remain visible instead of being cherry-picked away", () => {
  const event = {
    event: "paid_capability_settled",
    at: "2026-09-16T20:05:00.000Z",
    capabilityId: "json-schema-validate",
    responseStatus: 400,
    success: true,
    network: "eip155:8453",
    amount: "1000",
    transactionHash: "fedcba9876543210",
    executionId: null,
    responseSha256: null,
    deploymentCommitSha: "c".repeat(40)
  };

  const history = runMerge(JSON.stringify(event));
  assert.equal(history.settlementCount, 1);
  assert.equal(history.successfulDeliveryCount, 0);
  assert.equal(history.settledButNon2xxCount, 1);
  assert.equal(history.settlements[0].deliveryEvidenceComplete, false);
});

test("overlapping log windows are idempotently deduplicated", () => {
  const event = {
    event: "paid_capability_settled",
    at: "2026-09-16T20:10:00.000Z",
    capabilityId: "x402-payment-preflight",
    responseStatus: 200,
    success: true,
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    amount: "1000",
    transactionFingerprint: "0011223344556677",
    executionId: "22222222-2222-4222-8222-222222222222",
    responseSha256: "d".repeat(64),
    deploymentCommitSha: "e".repeat(40)
  };

  const first = runMerge(JSON.stringify(event));
  const second = runMerge(
    [JSON.stringify(event), JSON.stringify({ message: JSON.stringify(event) })].join("\n"),
    first
  );

  assert.equal(second.settlementCount, 1);
  assert.equal(second.uniqueTransactionFingerprintCount, 1);
  assert.deepEqual(second.byCapability, { "x402-payment-preflight": 1 });
  assert.deepEqual(second.byNetwork, { "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": 1 });
});

test("public evidence contract links versioned settlement history without claiming independence", () => {
  const source = readFileSync("src/app/.well-known/agentresolver-evidence.json/route.ts", "utf8");
  assert.match(source, /evidence-history\/evidence\/settlements\.json/);
  assert.match(source, /Versioned first-party x402 settlement evidence/);
  assert.match(source, /syntheticTrustScorePublished: false/);
  assert.match(source, /not an independent or on-chain reputation registry/i);
});
