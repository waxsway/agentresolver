import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type ManifestResource = {
  resource?: string;
  name?: string;
  price?: string;
  inputSchema?: {
    required?: string[];
    properties?: Record<string, unknown>;
  };
  accepts?: Array<{
    network?: string;
    payTo?: string;
    maxAmountRequired?: string;
  }>;
};

test("public x402 manifest advertises Payment Preflight as a payable resource", () => {
  const manifest = JSON.parse(
    readFileSync("public/.well-known/x402", "utf8")
  ) as { resources?: ManifestResource[] };

  const preflight = manifest.resources?.find(
    (item) => item.resource === "POST /api/x402-payment-preflight"
  );

  assert.ok(preflight, "Payment Preflight must remain in /.well-known/x402");
  assert.equal(preflight.price, "$0.001");
  assert.ok(preflight.name?.includes("Verify x402 Before Paying"));
  assert.deepEqual(preflight.inputSchema?.required, ["url"]);
  assert.ok(preflight.inputSchema?.properties?.expectedPayTo);
  assert.ok(preflight.inputSchema?.properties?.expectedNetwork);
  assert.equal(preflight.accepts?.[0]?.network, "eip155:8453");
  assert.equal(preflight.accepts?.[0]?.maxAmountRequired, "1000");
  assert.equal(
    preflight.accepts?.[0]?.payTo,
    "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
  );
});
