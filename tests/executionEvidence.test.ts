import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  buildExecutionEvidence,
  EXECUTION_EVIDENCE_URL,
  executionEvidenceHeaders,
  sha256Utf8
} from "../src/lib/executionEvidence";
import { GET as getEvidenceContract } from "../src/app/.well-known/agentresolver-evidence.json/route";

test("execution evidence hashes exact UTF-8 response bytes deterministically", () => {
  const body = JSON.stringify({ pong: true, value: 42 });
  const evidence = buildExecutionEvidence(
    body,
    "x402-ping",
    "11111111-1111-4111-8111-111111111111",
    "2026-09-16T19:45:00.000Z",
    "0123456789abcdef0123456789abcdef01234567"
  );

  assert.equal(evidence.responseSha256, sha256Utf8(body));
  assert.equal(evidence.capabilityId, "x402-ping");
  assert.equal(evidence.deploymentCommitSha, "0123456789abcdef0123456789abcdef01234567");
  assert.equal(evidence.evidenceUrl, EXECUTION_EVIDENCE_URL);

  const headers = executionEvidenceHeaders(evidence);
  assert.equal(headers["x-agentresolver-execution-id"], evidence.executionId);
  assert.equal(headers["x-agentresolver-response-sha256"], evidence.responseSha256);
  assert.equal(headers["x-agentresolver-evidence"], EXECUTION_EVIDENCE_URL);
});

test("public evidence contract is explicit about what it proves and does not prove", async () => {
  const previousSha = process.env.VERCEL_GIT_COMMIT_SHA;
  process.env.VERCEL_GIT_COMMIT_SHA = "0123456789abcdef0123456789abcdef01234567";
  try {
    const response = getEvidenceContract();
    const body = await response.json();

    assert.equal(body.model, "trust-minimized-verifiable-execution");
    assert.equal(body.claims.nonCustodial, true);
    assert.equal(body.claims.responseDeliveryCanBeHashed, true);
    assert.equal(body.claims.providerLegitimacyGuaranteed, false);
    assert.equal(body.claims.futureFulfillmentGuaranteed, false);
    assert.equal(body.historicalReputation.aggregatePublished, true);
    assert.equal(body.historicalReputation.scorePublished, false);
    assert.equal(
      body.historicalReputation.aggregateUrl,
      "https://agentresolver.vercel.app/.well-known/agentresolver-reputation.json"
    );
    assert.match(body.historicalReputation.inclusionRule, /independently verified on-chain USDC transfer/);
    assert.equal(body.responseEvidence.headers.responseSha256, "x-agentresolver-response-sha256");
    assert.equal(body.settlementEvidence.settlementHeader, "payment-response");
  } finally {
    if (previousSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = previousSha;
  }
});

test("generated OpenAPI advertises execution evidence headers", () => {
  const openapi = JSON.parse(readFileSync("public/openapi.json", "utf8"));
  const response = openapi.paths["/api/x402-payment-preflight"].post.responses["200"];

  assert.ok(response.headers["x-agentresolver-execution-id"]);
  assert.ok(response.headers["x-agentresolver-response-sha256"]);
  assert.ok(response.headers["x-agentresolver-deployment"]);
  assert.ok(response.headers["x-agentresolver-evidence"]);
  assert.ok(response.headers["payment-response"]);
});
