import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateProcurementCandidate,
  rankProcurementCandidates,
  type ProcurementCandidate
} from "../src/lib/procurement";

const baseCandidate: ProcurementCandidate = {
  id: "candidate",
  source: "test",
  sourceRank: 1,
  name: "Search API",
  description: "Search public data",
  endpoint: "https://example.com/search",
  protocol: "x402",
  priceUsd: 0.02,
  networks: ["eip155:8453"],
  inputSchema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"]
  },
  outputSchema: {
    type: "object",
    properties: { results: { type: "array" } },
    required: ["results"]
  },
  sideEffect: "read-only",
  auth: "wallet",
  execute: { url: "https://example.com/search" }
};

test("procurement rejects candidates that violate hard spend or network constraints", () => {
  const evaluated = evaluateProcurementCandidate(baseCandidate, {
    maxPriceUsd: 0.01,
    preferredNetworks: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
    protocol: "x402"
  });

  assert.equal(evaluated.status, "rejected");
  assert.ok(evaluated.rejectionReasons.some((reason) => reason.startsWith("price_exceeds_budget")));
  assert.ok(evaluated.rejectionReasons.includes("network_mismatch"));
});

test("procurement uses schema contracts when candidate metadata proves them", () => {
  const evaluated = evaluateProcurementCandidate(baseCandidate, {
    maxPriceUsd: 0.05,
    preferredNetworks: ["eip155:8453"],
    protocol: "x402",
    availableInputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"]
    },
    requiredOutputSchema: {
      type: "object",
      properties: { results: { type: "array" } },
      required: ["results"]
    },
    sideEffect: "read-only",
    auth: "wallet"
  });

  assert.equal(evaluated.status, "eligible");
  assert.equal(evaluated.contractChecks.input?.verdict, "compatible");
  assert.equal(evaluated.contractChecks.output?.verdict, "compatible");
  assert.deepEqual(evaluated.unknownConstraints, []);
});

test("unknown catalog metadata is surfaced instead of treated as verified", () => {
  const evaluated = evaluateProcurementCandidate(
    {
      ...baseCandidate,
      inputSchema: null,
      outputSchema: null,
      sideEffect: "unknown",
      auth: "unknown"
    },
    {
      availableInputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"]
      },
      requiredOutputSchema: {
        type: "object",
        properties: { results: { type: "array" } },
        required: ["results"]
      },
      sideEffect: "read-only",
      auth: "wallet"
    }
  );

  assert.equal(evaluated.status, "eligible_with_unknowns");
  assert.deepEqual(
    [...evaluated.unknownConstraints].sort(),
    ["auth", "input_contract", "output_contract", "side_effect"].sort()
  );
});

test("ranking prefers proven candidates over unknown or rejected candidates", () => {
  const ranked = rankProcurementCandidates(
    [
      { ...baseCandidate, id: "unknown", sourceRank: 1, outputSchema: null },
      { ...baseCandidate, id: "proven", sourceRank: 2 },
      { ...baseCandidate, id: "expensive", sourceRank: 1, priceUsd: 5 }
    ],
    {
      maxPriceUsd: 0.05,
      requiredOutputSchema: {
        type: "object",
        properties: { results: { type: "array" } },
        required: ["results"]
      }
    },
    3
  );

  assert.equal(ranked[0]?.id, "proven");
  assert.equal(ranked[0]?.status, "eligible");
  assert.equal(ranked[1]?.id, "unknown");
  assert.equal(ranked[1]?.status, "eligible_with_unknowns");
  assert.equal(ranked[2]?.id, "expensive");
  assert.equal(ranked[2]?.status, "rejected");
});
