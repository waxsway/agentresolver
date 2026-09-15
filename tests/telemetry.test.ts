import assert from "node:assert/strict";
import test from "node:test";
import {
  callerHash,
  classifyIntent,
  referrerHost,
  safeUserAgent,
  shortHash
} from "../src/lib/telemetry";

test("shortHash is stable and does not expose the original value", () => {
  const value = "203.0.113.10";
  const first = shortHash(value);
  assert.equal(first, shortHash(value));
  assert.equal(first.length, 16);
  assert.notEqual(first, value);
});

test("classifyIntent returns coarse demand categories", () => {
  assert.deepEqual(classifyIntent("Find a browser tool to scrape a product page"), ["web", "search", "commerce"]);
  assert.deepEqual(classifyIntent("something unusual"), ["other"]);
});

test("request telemetry uses hashed caller identity and bounded metadata", () => {
  const req = new Request("https://agentresolver.vercel.app/mcp", {
    headers: {
      "x-forwarded-for": "203.0.113.10, 198.51.100.1",
      "user-agent": "ExampleAgent/1.0",
      referer: "https://example.com/path?secret=1"
    }
  });

  assert.equal(callerHash(req), shortHash("203.0.113.10"));
  assert.equal(safeUserAgent(req), "ExampleAgent/1.0");
  assert.equal(referrerHost(req), "example.com");
});
