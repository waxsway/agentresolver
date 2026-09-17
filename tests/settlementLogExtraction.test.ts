import assert from "node:assert/strict";
import test from "node:test";
// Runtime helper is intentionally plain Node ESM so the Actions publisher can execute it without a build step.
// @ts-expect-error The .mjs helper has no TypeScript declaration; behavior is covered by these regression tests.
import { extractSettlementEventsFromText } from "../scripts/extract-settlement-log-events.mjs";

const settlement = {
  event: "paid_capability_settled",
  at: "2026-09-17T04:41:01.614Z",
  capabilityId: "x402-ping",
  requestId: "2d86587c-54f5-4fb5-9a45-0e3595cbdd53",
  responseStatus: 200,
  success: true,
  network: "eip155:8453",
  amount: null,
  transactionFingerprint: "f7d86b07a860dfdc",
  transactionReference: "0x7729766d8615c6bd052340bddc95019be20afd78c2cd39faa4812775e3227b72",
  payerHash: "1b94be31cfcf33bb",
  executionId: "386c74db-e20a-40ea-9a3a-d61117a058f5",
  responseSha256: "72371b8d1e560ff9e22040eea54b8458ff9ec37766664166dda19a931afcb4e2",
  deploymentCommitSha: "56dcfa59c9d180e23a7396efd5e64bcf35c2f968"
};

test("extracts a settlement from a Vercel-style multiline request log envelope", () => {
  const multiline = [
    JSON.stringify({ event: "paid_capability_attempt", success: true }),
    '[x402] extension responses: {"bazaar":{"status":"processing"}}',
    JSON.stringify({ event: "paid_capability_completed", capabilityId: "x402-ping" }),
    JSON.stringify(settlement)
  ].join("\n");

  const raw = JSON.stringify({
    timestamp: 1789610461614,
    level: "info",
    message: multiline,
    requestPath: "/api/x402-ping"
  });

  const events = extractSettlementEventsFromText(raw);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], settlement);
});

test("extracts direct settlement JSONL and ignores unrelated structured logs", () => {
  const raw = [
    JSON.stringify({ event: "paid_capability_attempt", success: true }),
    JSON.stringify(settlement),
    JSON.stringify({ message: "plain text" })
  ].join("\n");

  const events = extractSettlementEventsFromText(raw);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], settlement);
});

test("deduplicates the same settlement discovered through nested fields", () => {
  const nested = JSON.stringify({
    message: JSON.stringify(settlement),
    data: JSON.stringify(settlement)
  });

  const events = extractSettlementEventsFromText(nested);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], settlement);
});
