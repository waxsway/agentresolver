import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { describeOpenApiDocument } from "../src/lib/agentReadiness";

test("large OpenAPI documents are not mislabeled invalid when the bounded prefix has a version", () => {
  const truncatedPrefix =
    '{"openapi":"3.1.0","info":{"title":"Large API"},"paths":{' +
    " ".repeat(130_000);

  assert.equal(
    describeOpenApiDocument(truncatedPrefix, true),
    "OpenAPI 3.1.0 found (large document; version verified from bounded prefix)."
  );
});

test("ordinary invalid OpenAPI responses remain invalid", () => {
  assert.equal(
    describeOpenApiDocument("<html>not openapi</html>", false),
    "OpenAPI path responded but did not contain valid JSON."
  );
});

test("readiness fetch retains a bounded prefix instead of discarding large HTTP 200 bodies", () => {
  const source = readFileSync("src/lib/agentReadiness.ts", "utf8");

  assert.doesNotMatch(source, /declaredLength\s*>\s*MAX_BYTES/);
  assert.match(source, /buffer\.subarray\(0, remaining\)/);
  assert.match(source, /truncated: true/);
});
