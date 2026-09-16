import assert from "node:assert/strict";
import test from "node:test";
import { runHashEncode } from "../src/lib/hashEncode";

test("hash and encoding primitive returns deterministic results", () => {
  assert.equal(
    runHashEncode({ operation: "sha256", input: "agentresolver" }).result,
    "206c438b0ceeb41e34a19e134396e4dc317e4cc71863065c2da451326a2f5d77"
  );
  assert.equal(
    runHashEncode({ operation: "base64-encode", input: "hello" }).result,
    "aGVsbG8="
  );
  assert.equal(
    runHashEncode({ operation: "base64-decode", input: "aGVsbG8=" }).result,
    "hello"
  );
});

test("hmac requires a secret and JWT decode never claims verification", () => {
  assert.throws(
    () => runHashEncode({ operation: "hmac-sha256", input: "hello" }),
    /secret is required/
  );

  const jwt = [
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: "123" })).toString("base64url"),
    "signature"
  ].join(".");
  const decoded = runHashEncode({ operation: "jwt-decode", input: jwt });
  assert.equal(decoded.verified, false);
  assert.deepEqual(decoded.payload, { sub: "123" });
});

test("hash and encoding primitive bounds input size", () => {
  assert.throws(
    () => runHashEncode({ operation: "sha256", input: "x".repeat(128 * 1024 + 1) }),
    /input exceeds/
  );
});
