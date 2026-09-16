import assert from "node:assert/strict";
import test from "node:test";
import { normalizeJson, validateJsonSchema, parseUrl, generateUuidV4, slugify } from "../src/lib/deterministicUtilities";

test("json normalization is stable and hashed", () => {
  const a = normalizeJson({ b: 2, a: 1 });
  const b = normalizeJson({ a: 1, b: 2 });
  assert.equal(a.normalized, '{"a":1,"b":2}');
  assert.equal(a.normalized, b.normalized);
  assert.equal(a.sha256, b.sha256);
});

test("json schema subset returns path-level errors", () => {
  const report = validateJsonSchema(
    { id: 123, extra: true },
    { type: "object", required: ["id"], additionalProperties: false, properties: { id: { type: "string" } } }
  );
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((item) => item.path === "$.id" && item.keyword === "type"));
  assert.ok(report.errors.some((item) => item.path === "$.extra" && item.keyword === "additionalProperties"));
});

test("URL parser preserves duplicate query keys", () => {
  const parsed = parseUrl("https://example.com/a?x=1&x=2#frag");
  assert.deepEqual(parsed.query.x, ["1", "2"]);
  assert.equal(parsed.fragment, "frag");
});

test("UUID generator and slugifier are bounded deterministic utilities", () => {
  const ids = generateUuidV4(2);
  assert.equal(ids.values.length, 2);
  assert.match(ids.values[0], /^[0-9a-f-]{36}$/i);
  assert.equal(slugify("Hello, Agent World!").slug, "hello-agent-world");
});
