import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/app/mcp/route.ts", import.meta.url), "utf8");

test("MCP resolve can directly recommend canonical x402 payment preflight", () => {
  const directOwnedBlock = source.match(/const directOwnedId = topOwned\?\.id && topOwned\.id in \{([\s\S]*?)\n    \} \? topOwned\.id as PaidCapabilityId : null;/)?.[1] || "";

  assert.match(directOwnedBlock, /"x402-payment-preflight": true/);
  assert.match(source, /directOwnedId === "x402-payment-preflight"\s*\? "x402_payment_preflight"/);
  assert.match(source, /const x402PaymentPreflightProduct = getPaidCapability\("x402-payment-preflight"\)/);
});
