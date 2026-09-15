import assert from "node:assert/strict";
import test from "node:test";
import { validateHttpInspectTarget } from "../src/lib/httpInspect";

test("HTTP inspection accepts a normal public HTTPS URL shape", () => {
  const url = validateHttpInspectTarget("https://example.com/path?q=1#fragment");
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "example.com");
  assert.equal(url.pathname, "/path");
  assert.equal(url.search, "?q=1");
  assert.equal(url.hash, "");
});

test("HTTP inspection rejects non-HTTPS, credentials, custom ports and local hosts", () => {
  const rejected = [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com:8443",
    "https://localhost",
    "https://service.internal",
    "https://127.0.0.1",
    "https://10.0.0.5",
    "https://192.168.1.10",
    "https://169.254.169.254",
    "https://[::1]"
  ];

  for (const target of rejected) {
    assert.throws(() => validateHttpInspectTarget(target), undefined, target);
  }
});

test("HTTP inspection bounds target length", () => {
  assert.throws(
    () => validateHttpInspectTarget(`https://example.com/${"a".repeat(600)}`),
    /500 characters/
  );
});
