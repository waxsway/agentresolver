import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PAID_CAPABILITIES } from "../src/lib/paidCapabilities";

test("seller machine funnel exposes a low-friction x402 entry and full distribution upsell", () => {
  const launch = PAID_CAPABILITIES["provider-launch-check"];
  const pack = PAID_CAPABILITIES["agent-distribution-pack"];

  assert.equal(launch.priceUsd, 0.05);
  assert.match(launch.description, /low-friction/i);
  assert.match(launch.description, /agent distribution/i);
  assert.match(launch.description, /\$5 Agent Distribution Pack/i);

  assert.equal(pack.priceUsd, 5);
  assert.match(pack.description, /API agent distribution/i);
  assert.match(pack.description, /MCP discoverability/i);
  assert.match(pack.description, /MCP distribution/i);
  assert.match(pack.description, /agent-service launch/i);
});

test("paid launch-check result points sellers to the full Distribution Pack", () => {
  const source = readFileSync("src/lib/providerLaunchCheck.ts", "utf8");
  assert.match(source, /capabilityId: "agent-distribution-pack"/);
  assert.match(source, /priceUsd: 5/);
  assert.match(source, /ready-to-commit launch artifacts/i);
});

test("machine metadata documents the same seller price ladder", () => {
  const source = readFileSync("scripts/compact-public-paid-discovery.ts", "utf8");
  assert.match(source, /start with GET or POST \/api\/provider-launch-check \(\$0\.05\)/);
  assert.match(source, /POST \/api\/agent-distribution-pack \(\$5\)/);
});
