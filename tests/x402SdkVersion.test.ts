import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const packages = ["core", "evm", "extensions", "mcp", "next", "svm"];

test("x402 server packages stay aligned on the interoperability release", () => {
  for (const name of packages) {
    const key = `@x402/${name}`;
    assert.equal(packageJson.dependencies[key], "2.26.0", key);
    assert.equal(packageLock.packages[""].dependencies[key], "2.26.0", key);
    assert.equal(packageLock.packages[`node_modules/${key}`].version, "2.26.0", key);
  }

  assert.equal(packageLock.packages["node_modules/@x402/evm"].dependencies["@x402/core"], "~2.26.0");
  assert.equal(packageLock.packages["node_modules/@x402/extensions"].dependencies["@x402/core"], "~2.26.0");
  assert.equal(packageLock.packages["node_modules/@x402/mcp"].dependencies["@x402/core"], "~2.26.0");
  assert.equal(packageLock.packages["node_modules/@x402/next"].dependencies["@x402/core"], "~2.26.0");
  assert.equal(packageLock.packages["node_modules/@x402/next"].dependencies["@x402/extensions"], "~2.26.0");
  assert.equal(packageLock.packages["node_modules/@x402/svm"].dependencies["@x402/core"], "~2.26.0");
});
