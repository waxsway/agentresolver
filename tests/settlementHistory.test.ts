import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const SCRIPT = "scripts/merge-settlement-history.mjs";

test("settlement verifier passes Base/Solana, privacy, rejection, and idempotency self-tests", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--self-test"], {
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /on-chain verifier self-test PASSED/);
});

test("empty first-party history migrates to verified schema without manufacturing evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentresolver-settlement-history-"));
  const historyPath = join(dir, "history.json");
  const logsPath = join(dir, "logs.jsonl");
  const outputPath = join(dir, "output.json");

  writeFileSync(historyPath, JSON.stringify({
    schemaVersion: 1,
    service: "AgentResolver",
    lastUpdatedAt: null,
    settlements: []
  }));
  writeFileSync(logsPath, "");

  const result = spawnSync(
    process.execPath,
    [SCRIPT, "--history", historyPath, "--logs", logsPath, "--output", outputPath],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const history = JSON.parse(readFileSync(outputPath, "utf8"));
  assert.equal(history.schemaVersion, 2);
  assert.equal(history.settlementCount, 0);
  assert.equal(history.independentlyVerifiedSettlementCount, 0);
  assert.equal(history.successfulVerifiedExecutionCount, 0);
  assert.equal(history.unverifiedLegacySettlementCount, 0);
  assert.equal(history.lastUpdatedAt, null);
  assert.equal(history.verification.independentOnchainVerificationRequired, true);
  assert.equal(history.exclusions.syntheticTrustScore, true);
});

test("public evidence contract names the independent verification boundary", () => {
  const source = readFileSync(
    "src/app/.well-known/agentresolver-evidence.json/route.ts",
    "utf8"
  );
  assert.match(source, /independent public-chain USDC transfer check/i);
  assert.match(source, /agentresolver-reputation\.json/);
  assert.match(source, /syntheticTrustScorePublished: false/);
  assert.match(source, /provider legitimacy/i);
});
