import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type ManifestResource = {
  resource?: string;
  name?: string;
  price?: string;
  endpoint?: string;
  facilitator?: string;
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
  assert.ok(preflight.name?.includes("Preflight"));
  assert.match(preflight.name ?? "", /Before Paying/i);
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


test("public x402 manifest advertises the Base-only Coinbase CDP Guard", () => {
  const manifest = JSON.parse(
    readFileSync("public/.well-known/x402", "utf8")
  ) as {
    services?: Array<Record<string, any>>;
    resources?: ManifestResource[];
  };

  const service = manifest.services?.find(
    (item) => item.id === "cdp-payment-guard"
  );
  assert.ok(service, "CDP Guard service must remain in /.well-known/x402");
  assert.equal(service.endpoint, "https://agentresolver.vercel.app/api/cdp-payment-guard");
  assert.equal(service.method, "GET");
  assert.equal(service.price_usdc, "0.002");
  assert.equal(service.price_atomic, 2000);
  assert.equal(service.facilitator, "https://api.cdp.coinbase.com/platform/v2/x402");

  const guard = manifest.resources?.find(
    (item) => item.resource === "GET /api/cdp-payment-guard"
  ) as (ManifestResource & { price_usdc?: string; price_atomic?: number; tags?: string[] }) | undefined;

  assert.ok(guard, "CDP Guard resource must remain in /.well-known/x402");
  assert.equal(guard.endpoint, "https://agentresolver.vercel.app/api/cdp-payment-guard");
  assert.equal(guard.price, "$0.002");
  assert.equal(guard.price_usdc, "0.002");
  assert.equal(guard.price_atomic, 2000);
  assert.equal(guard.facilitator, "https://api.cdp.coinbase.com/platform/v2/x402");
  assert.deepEqual(guard.inputSchema?.required, ["url"]);
  assert.equal(guard.accepts?.length, 1);
  assert.equal(guard.accepts?.[0]?.network, "eip155:8453");
  assert.equal(guard.accepts?.[0]?.maxAmountRequired, "2000");
  assert.equal(
    guard.accepts?.[0]?.payTo,
    "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
  );
});
