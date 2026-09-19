import assert from "node:assert/strict";
import test from "node:test";
import {
  createSignedAttributionReceipt,
  MAX_ATTRIBUTION_RECEIPT_LENGTH,
  verifySignedAttributionReceipt
} from "../src/lib/attributionReceipt";

const SECRET =
  "test-only-agentresolver-attribution-secret-00000000000000000000";

const BASE_INPUT = {
  attributionId: "atr_123e4567-e89b-42d3-a456-426614174000",
  routeId: "searchco:web-search",
  providerId: "searchco",
  capabilityId: "web-search",
  execute: {
    method: "POST" as const,
    url: "https://search.example/api",
    priceUsd: 0.05,
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x2222222222222222222222222222222222222222",
    amountAtomic: "50000"
  },
  inputFingerprint: "d34db33fd34db33f"
};

test("signed attribution receipt round-trips and binds provider execution terms", () => {
  const now = new Date("2026-09-19T02:00:00.000Z");
  const signed = createSignedAttributionReceipt(BASE_INPUT, SECRET, {
    now,
    ttlSeconds: 900
  });

  assert.match(signed.receipt, /^ar1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(signed.payload.routeId, "searchco:web-search");
  assert.equal(signed.payload.execute.amountAtomic, "50000");

  const verified = verifySignedAttributionReceipt(
    signed.receipt,
    SECRET,
    { now: new Date("2026-09-19T02:05:00.000Z") }
  );

  assert.equal(verified.valid, true);
  if (!verified.valid) throw new Error("expected valid receipt");
  assert.equal(verified.payload.providerId, "searchco");
  assert.equal(verified.payload.execute.payTo, BASE_INPUT.execute.payTo);
  assert.equal(verified.payload.inputFingerprint, BASE_INPUT.inputFingerprint);
});

test("changing any encoded receipt payload invalidates the signature", () => {
  const signed = createSignedAttributionReceipt(BASE_INPUT, SECRET, {
    now: new Date("2026-09-19T02:00:00.000Z")
  });
  const [prefix, payload, signature] = signed.receipt.split(".");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  decoded.routeId = "attacker:route";
  const tamperedPayload = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");

  const verified = verifySignedAttributionReceipt(
    `${prefix}.${tamperedPayload}.${signature}`,
    SECRET,
    { now: new Date("2026-09-19T02:05:00.000Z") }
  );

  assert.equal(verified.valid, false);
  assert.equal(verified.reason, "invalid_signature");
});

test("receipts expire and cannot be replayed indefinitely", () => {
  const signed = createSignedAttributionReceipt(BASE_INPUT, SECRET, {
    now: new Date("2026-09-19T02:00:00.000Z"),
    ttlSeconds: 120
  });

  const verified = verifySignedAttributionReceipt(
    signed.receipt,
    SECRET,
    { now: new Date("2026-09-19T02:03:00.000Z") }
  );

  assert.equal(verified.valid, false);
  assert.equal(verified.reason, "expired_receipt");
});

test("a different server secret cannot validate another issuer's receipt", () => {
  const signed = createSignedAttributionReceipt(BASE_INPUT, SECRET, {
    now: new Date("2026-09-19T02:00:00.000Z")
  });

  const verified = verifySignedAttributionReceipt(
    signed.receipt,
    "different-test-secret-that-is-also-at-least-thirty-two-bytes",
    { now: new Date("2026-09-19T02:05:00.000Z") }
  );

  assert.equal(verified.valid, false);
  assert.equal(verified.reason, "invalid_signature");
});

test("receipt issuer rejects undersized signing secrets", () => {
  assert.throws(
    () => createSignedAttributionReceipt(BASE_INPUT, "too-short"),
    /at least 32 bytes/
  );
});


test("receipt verifier rejects oversized input before base64 or JSON decoding", () => {
  const oversized = "ar1." + "A".repeat(MAX_ATTRIBUTION_RECEIPT_LENGTH) + ".signature";
  const verified = verifySignedAttributionReceipt(oversized, SECRET);
  assert.equal(verified.valid, false);
  assert.equal(verified.reason, "malformed_receipt");
  assert.equal(verified.payload, null);
});

test("receipt verifier rejects non-canonical or wrong-length signatures", () => {
  const signed = createSignedAttributionReceipt(BASE_INPUT, SECRET, {
    now: new Date("2026-09-19T02:00:00.000Z")
  });
  const [prefix, payload] = signed.receipt.split(".");

  for (const signature of ["abc", "A".repeat(43) + "=", "!".repeat(43)]) {
    const verified = verifySignedAttributionReceipt(
      `${prefix}.${payload}.${signature}`,
      SECRET,
      { now: new Date("2026-09-19T02:05:00.000Z") }
    );
    assert.equal(verified.valid, false);
    assert.equal(verified.reason, "malformed_receipt");
    assert.equal(verified.payload, null);
  }
});

test("receipt issuer refuses private, local and custom-port execution targets", () => {
  for (const url of [
    "https://127.0.0.1/api",
    "https://localhost/api",
    "https://provider.internal/api",
    "https://example.com:8443/api"
  ]) {
    assert.throws(
      () =>
        createSignedAttributionReceipt(
          {
            ...BASE_INPUT,
            execute: { ...BASE_INPUT.execute, url }
          },
          SECRET
        ),
      /payload is invalid/
    );
  }
});

test("invalid signatures do not return attacker-controlled decoded payload", () => {
  const signed = createSignedAttributionReceipt(BASE_INPUT, SECRET, {
    now: new Date("2026-09-19T02:00:00.000Z")
  });
  const [prefix, payload] = signed.receipt.split(".");
  const attackerSignature = "A".repeat(43);

  const verified = verifySignedAttributionReceipt(
    `${prefix}.${payload}.${attackerSignature}`,
    SECRET,
    { now: new Date("2026-09-19T02:05:00.000Z") }
  );

  assert.equal(verified.valid, false);
  assert.equal(verified.reason, "invalid_signature");
  assert.equal(verified.payload, null);
});
