import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type ToolManifest = {
  type?: string;
  name?: string;
  description?: string;
  endpoint?: string;
  creatorAddress?: string;
  inputs?: { required?: string[]; properties?: Record<string, unknown> };
  outputs?: { required?: string[]; properties?: Record<string, unknown> };
  pricing?: Array<{ amount?: string; asset?: string; recipient?: string; protocol?: string }>;
  verifiability?: { tier?: string; execution?: string; sourceVisibility?: string };
};

test("OpenSea ERC-8257 Guard manifest stays bound to the live CDP Guard", () => {
  const manifest = JSON.parse(
    readFileSync("public/.well-known/ai-tool/agentresolver-guard.json", "utf8")
  ) as ToolManifest;

  assert.equal(manifest.type, "https://ercs.ethereum.org/ERCS/erc-8257#tool-manifest-v1");
  assert.equal(manifest.name, "AgentResolver Guard");
  assert.ok((manifest.description ?? "").length > 0);
  assert.ok((manifest.description ?? "").length <= 500);
  assert.equal(manifest.endpoint, "https://agentresolver.vercel.app/api/cdp-payment-guard");
  assert.equal(manifest.creatorAddress, "0x66e19457ffc829e8ed74706f5c1399c6f6466de8");
  assert.match(manifest.creatorAddress ?? "", /^0x[0-9a-f]{40}$/);

  assert.deepEqual(manifest.inputs?.required, ["url"]);
  assert.ok(manifest.inputs?.properties?.url);
  assert.ok(manifest.inputs?.properties?.method);
  assert.ok(manifest.inputs?.properties?.maxPriceUsd);
  assert.ok(manifest.inputs?.properties?.expectedPayTo);
  assert.ok(manifest.inputs?.properties?.expectedNetwork);
  assert.deepEqual(
    new Set(manifest.outputs?.required ?? []),
    new Set(["guard", "prepaymentDecision", "evidenceReceipt"])
  );

  assert.equal(manifest.pricing?.length, 1);
  assert.equal(manifest.pricing?.[0]?.amount, "2000");
  assert.equal(
    manifest.pricing?.[0]?.asset,
    "eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
  );
  assert.equal(
    manifest.pricing?.[0]?.recipient,
    "eip155:8453:0x66e19457ffc829e8ed74706f5c1399c6f6466de8"
  );
  assert.equal(manifest.pricing?.[0]?.protocol, "x402");

  assert.equal(manifest.verifiability?.tier, "self-attested");
  assert.equal(manifest.verifiability?.execution, "standard");
  assert.equal(manifest.verifiability?.sourceVisibility, "open-source");
});
