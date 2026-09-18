import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("provider registry requires paid launch proof before static activation", () => {
  const source = readFileSync("src/lib/providerNetwork.ts", "utf8");
  assert.match(source, /requireLaunchProof/);
  assert.match(source, /amountAtomic === "50000"/);
  assert.match(source, /providerPartnersJson as unknown, true/);
});

test("provider registry has independent Base USDC launch-payment verification workflow", () => {
  const workflow = readFileSync(".github/workflows/provider-partner-registry.yml", "utf8");
  const verifier = readFileSync("scripts/verify-provider-partners.mjs", "utf8");
  assert.match(workflow, /verify-provider-partners\.mjs/);
  assert.match(verifier, /50000/);
  assert.match(verifier, /eth_getTransactionReceipt/);
  assert.match(verifier, /0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8/i);
});
