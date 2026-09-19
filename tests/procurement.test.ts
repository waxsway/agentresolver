import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateProcurementCandidate,
  evaluateProcurementSemanticEvidence,
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


test("semantic capability evidence fails closed for a broad directory match", () => {
  const evaluated = evaluateProcurementCandidate(
    {
      ...baseCandidate,
      name: "Anybrowse",
      description: "URL-to-Markdown scraping",
      protocol: "mcp",
      priceUsd: null,
      networks: [],
      inputSchema: null,
      outputSchema: null,
      sideEffect: "unknown",
      auth: "unknown"
    },
    { protocol: "mcp", requireHttps: false },
    "persistent local browser workspace that preserves named tabs and site storage across client sessions, allows human takeover, and supports fresh post-action reads"
  );

  assert.equal(evaluated.status, "eligible_with_unknowns");
  assert.ok(evaluated.unknownConstraints.includes("semantic_capability"));
  assert.equal(evaluated.semanticMatch?.proven, false);
});

test("semantic capability evidence accepts a candidate whose metadata covers the requested job", () => {
  const evaluated = evaluateProcurementCandidate(
    {
      ...baseCandidate,
      name: "Public Search API",
      description: "Search public data and return search results"
    },
    {},
    "search public data"
  );

  assert.equal(evaluated.status, "eligible");
  assert.equal(evaluated.semanticMatch?.proven, true);
});


test("live MCP tool evidence can prove semantics that catalog metadata could not", () => {
  const candidate = evaluateProcurementCandidate(
    {
      ...baseCandidate,
      name: "Browser MCP",
      description: "Browser tools",
      protocol: "mcp",
      priceUsd: null,
      networks: []
    },
    { protocol: "mcp", requireHttps: false },
    "persistent browser workspace with named tabs and human takeover"
  );

  assert.equal(candidate.semanticMatch?.proven, false);
  const enriched = evaluateProcurementSemanticEvidence(
    "persistent browser workspace with named tabs and human takeover",
    candidate,
    "persistent browser workspace named tabs human takeover"
  );
  assert.equal(enriched?.proven, true);
});
