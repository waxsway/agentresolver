import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/register-true402.yml", "utf8");
const manifest = JSON.parse(readFileSync("public/.well-known/x402-service.json", "utf8"));

test("true402 manifest publishes the input-free $0.001 Base settlement canary", () => {
  assert.equal(manifest.x402, "1.0");
  assert.equal(manifest.endpoint, "https://agentresolver.vercel.app/api/x402-ping");
  assert.equal(manifest.pricing?.currency, "USDC");
  assert.equal(String(manifest.pricing?.base), "0.001");
  assert.equal(manifest.pricing?.unit, "request");
  assert.equal(manifest.payment?.address, "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8");
  assert.equal(manifest.payment?.chain, "base");
  assert.equal(manifest.payment?.facilitator, "https://facilitator.payai.network");
  assert.ok(manifest.capabilities?.includes("verification"));
});

test("true402 registration is zero-spend, anonymous, and manual-only after acceptance", () => {
  assert.match(workflow, /https:\/\/true402\.dev\/api/);
  assert.match(workflow, /v1\/services\/register/);
  assert.match(workflow, /POST "\$TRUE402_API\/v1\/services\/register"/);
  assert.match(workflow, /\{url:\$url\}/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s*push:/m);
  assert.doesNotMatch(workflow, /^\s*workflow_run:/m);
  assert.match(workflow, /x-agentresolver-internal: 1/);
  assert.match(workflow, /refusing duplicate registration/i);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE|X-PAYMENT|PRIVATE_KEY|SEED_PHRASE|email/i);
  assert.doesNotMatch(workflow, /schedule:/);
  assert.match(workflow, /id:\(\.id \/\/ \.data\.id \/\/ null\)/);
  assert.match(workflow, /status:\(\.status \/\/ \.data\.status \/\/ null\)/);
});

test("true402 lane validates the live manifest and x402 v2 canary before registration", () => {
  assert.match(workflow, /\.well-known\/x402-service\.json/);
  assert.match(workflow, /\.x402Version == 2/);
  assert.match(workflow, /\.network == "eip155:8453"/);
  assert.match(workflow, /\.amount == "1000"/);
  assert.match(workflow, /facilitator\.payai\.network/);
});
