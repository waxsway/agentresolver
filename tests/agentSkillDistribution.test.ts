import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const installable = readFileSync("skills/agentresolver-payment-guard/SKILL.md", "utf8");
const published = readFileSync("public/skill.md", "utf8");

test("repository exposes an installable AgentResolver payment Guard skill", () => {
  assert.match(installable, /^---\nname: agentresolver-payment-guard\n/m);
  assert.match(installable, /description: .*x402 payment terms/i);
  assert.match(installable, /GET https:\/\/agentresolver\.vercel\.app\/api\/payment-guard\?url=/);
  assert.match(installable, /\$0\.001 USDC/);
  assert.match(installable, /api\/x402-client-setup/);
  assert.match(installable, /before each autonomous x402 spend/i);
  assert.match(installable, /eligible.*does not authorize spending/is);
  assert.match(installable, /caller-owned signer/i);
});

test("published skill mirrors the current GET-first Guard contract", () => {
  assert.match(published, /^---\nname: agentresolver-payment-guard\n/m);
  assert.match(published, /GET https:\/\/agentresolver\.vercel\.app\/api\/payment-guard\?url=/);
  assert.match(published, /GET \/api\/x402-payment-preflight/);
  assert.match(published, /POST remains available/i);
  assert.match(published, /api\/x402-client-setup/);
  assert.match(published, /eip155:8453/);
  assert.match(published, /solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/);
  assert.match(published, /eligible.*does not authorize spending/is);
  assert.doesNotMatch(
    published,
    /Canonical paid verification route:\s*`POST https:\/\/agentresolver\.vercel\.app\/api\/x402-payment-preflight`/
  );
});


test("installable Guard skill documents the Coinbase AgentKit confirmation-first payment loop", () => {
  assert.match(installable, /## Coinbase AgentKit/);
  assert.match(installable, /make_http_request/);
  assert.match(installable, /retry_http_request_with_x402/);
  assert.match(installable, /discover_x402_services/);
  assert.match(installable, /list_registered_services/);
  assert.match(installable, /register_x402_service/);
  assert.match(installable, /allowDynamicServiceRegistration/);
  assert.match(installable, /registeredServices/);
  assert.match(installable, /Do not enable dynamic registration merely to bypass the service allowlist/i);
  assert.match(installable, /do not use `make_http_request_with_x402` on an unfamiliar target/i);
  assert.match(published, /## Coinbase AgentKit/);
});


test("installable Guard skill carries the executable MCP pre-sign gate", () => {
  assert.match(installable, /## MCP wallet-capable clients — fail-closed pre-sign gate/);
  assert.match(installable, /onPaymentRequested/);
  assert.match(installable, /hostAllowsGuardSpend/);
  assert.match(installable, /mcp:\/\/tool\/payment_guard/);
  assert.match(installable, /mcp:\/\/tool\/x402_payment_preflight/);
  assert.match(installable, /expectedResource/);
  assert.match(installable, /context\.paymentRequired\.x402Version !== 2/);
  assert.match(installable, /requirement\.amount === "1000"/);
  assert.match(installable, /requirement\.asset === expected\.asset/);
  assert.match(installable, /requirement\.payTo === expected\.payTo/);
  assert.match(installable, /Solana Base58 identifiers are case-sensitive/i);
  assert.doesNotMatch(installable, /requirement\.payTo\.toLowerCase/);
  assert.match(installable, /paymentRequirementsSelector/);
  assert.match(installable, /on_before_payment_creation/);
});


test("well-known skill discovery bytes stay synchronized with the canonical installable skill", () => {
  const discovered = readFileSync(
    "public/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md",
    "utf8"
  );
  const index = JSON.parse(readFileSync("public/.well-known/agent-skills/index.json", "utf8"));
  const digest = "sha256:" + createHash("sha256").update(discovered).digest("hex");

  assert.equal(discovered, installable);
  assert.equal(index.skills[0].name, "agentresolver-payment-guard");
  assert.equal(index.skills[0].digest, digest);
});


test("published compatibility skill points to the exact-resource pre-sign gate", () => {
  assert.match(published, /## MCP wallet-capable clients — fail-closed pre-sign gate/);
  assert.match(published, /onPaymentRequested/);
  assert.match(published, /mcp:\/\/tool\/payment_guard/);
  assert.match(published, /mcp:\/\/tool\/x402_payment_preflight/);
  assert.match(published, /amount === "1000"/);
  assert.match(published, /Solana Base58 asset and payTo values/i);
  assert.match(published, /\.well-known\/agent-skills\/agentresolver-payment-guard\/SKILL\.md/);
});
