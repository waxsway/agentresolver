import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  facilitatorRouterConfig,
  requestFingerprint,
  validateFacilitatorEnvelope
} from "../src/lib/x402FacilitatorRouter";

const baseEnvelope = {
  x402Version: 2,
  paymentPayload: {
    x402Version: 2,
    accepted: {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      amount: "1000",
      payTo: "0x0000000000000000000000000000000000000001"
    },
    payload: {}
  },
  paymentRequirements: {
    scheme: "exact",
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amount: "1000",
    payTo: "0x0000000000000000000000000000000000000001",
    maxTimeoutSeconds: 300
  }
};

test("facilitator router accepts Base and Solana x402 envelopes only", () => {
  assert.deepEqual(validateFacilitatorEnvelope(baseEnvelope), {
    network: "eip155:8453",
    x402Version: 2
  });

  const solana = structuredClone(baseEnvelope);
  solana.paymentRequirements.network = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
  solana.paymentPayload.accepted.network = solana.paymentRequirements.network;
  assert.equal(validateFacilitatorEnvelope(solana).network, solana.paymentRequirements.network);

  const unsupported = structuredClone(baseEnvelope);
  unsupported.paymentRequirements.network = "eip155:1";
  unsupported.paymentPayload.accepted.network = "eip155:1";
  assert.throws(() => validateFacilitatorEnvelope(unsupported), /Base and Solana/);
});

test("facilitator router rejects malformed envelopes before upstream", () => {
  assert.throws(() => validateFacilitatorEnvelope(null), /JSON object/);
  assert.throws(
    () => validateFacilitatorEnvelope({ ...baseEnvelope, x402Version: 3 }),
    /x402Version/
  );
  assert.throws(
    () => validateFacilitatorEnvelope({ ...baseEnvelope, paymentPayload: null }),
    /paymentPayload/
  );
});

test("router defaults to PayAI and prevents accidental self-routing loops", () => {
  const config = facilitatorRouterConfig({});
  assert.equal(config.primary, "https://facilitator.payai.network");
  assert.equal(config.verifySecondary, null);

  assert.throws(
    () => facilitatorRouterConfig({
      AGENTRESOLVER_ROUTER_PRIMARY_URL: "https://agentresolver.vercel.app"
    }),
    /cannot point back/
  );
});

test("request fingerprint is stable and does not expose the payment envelope", () => {
  const raw = JSON.stringify(baseEnvelope);
  const fingerprint = requestFingerprint(raw);
  assert.equal(fingerprint, requestFingerprint(raw));
  assert.match(fingerprint, /^[0-9a-f]{20}$/);
  assert.equal(fingerprint.includes("eip155"), false);
});

test("public facilitator routes preserve settlement fail-closed policy", () => {
  const source = readFileSync("src/lib/x402FacilitatorRouter.ts", "utf8");
  const settle = readFileSync("src/app/settle/route.ts", "utf8");
  const verify = readFileSync("src/app/verify/route.ts", "utf8");
  const supported = readFileSync("src/app/supported/route.ts", "utf8");

  assert.match(source, /facilitator_router_settlement_indeterminate/);
  assert.match(source, /retrySafe: false/);
  assert.match(source, /settlement state may be committed/i);
  assert.doesNotMatch(source, /verifySecondary[\s\S]{0,500}fetchUpstream\([^,]+, "\/settle"/);
  assert.match(settle, /routeSettle/);
  assert.match(verify, /routeVerify/);
  assert.match(supported, /routeSupported/);
});

test("router documentation keeps the non-custodial and no-blind-retry boundary explicit", () => {
  const docs = readFileSync("docs/x402-reliability-router.md", "utf8");
  assert.match(docs, /non-custodial router/i);
  assert.match(docs, /automatic settlement failover/i);
  assert.match(docs, /verify-only/i);
  assert.match(docs, /https:\/\/agentresolver\.vercel\.app/);
});
