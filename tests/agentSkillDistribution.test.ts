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


test("installable Guard skill exposes the Cloudflare Agents native x402 handoff", () => {
  for (const text of [installable, published]) {
    assert.match(text, /## Cloudflare Agents SDK — native x402 MCP/);
    assert.match(text, /withX402Client/);
    assert.match(text, /agents\/x402/);
    assert.match(text, /callTool\(onPaymentRequired/);
    assert.match(text, /non-null/);
    assert.match(text, /passing `null` enables automatic payment/i);
    assert.match(text, /PAYMENT-SIGNATURE/);
    assert.match(text, /second, separate authorization/i);
  }
});

test("installable Guard skill exposes the OpenAI Agents SDK signed-retry handoff", () => {
  for (const text of [installable, published]) {
    assert.match(text, /## OpenAI Agents SDK — approval-gated signed retry/);
    assert.match(text, /@openai\/agents/);
    assert.match(text, /openai-agents/);
    assert.match(text, /needsApproval/);
    assert.match(text, /needs_approval/);
    assert.match(text, /Hosted MCP approval is \*\*not\*\* an x402 signer/i);
    assert.match(text, /PAYMENT-SIGNATURE/);
    assert.match(text, /second, independent approval/i);
    assert.match(text, /Fail closed if the runtime cannot enforce approval/i);
  }
});

test("installable Guard skill documents the Coinbase AgentKit confirmation-first payment loop", () => {
  assert.match(installable, /## Coinbase AgentKit/);
  assert.match(installable, /make_http_request/);
  assert.match(installable, /retry_http_request_with_x402/);
  assert.match(installable, /discover_x402_services/);
  assert.match(installable, /Do \*\*not\*\* require Bazaar discovery before using AgentResolver/i);
  assert.match(installable, /register\/allowlist the exact AgentResolver origin directly/i);
  assert.match(installable, /missing AgentResolver result as catalog lag/i);
  assert.match(installable, /beforePayment.*PR #1454.*not merged/is);
  assert.match(installable, /list_registered_services/);
  assert.match(installable, /register_x402_service/);
  assert.match(installable, /allowDynamicServiceRegistration/);
  assert.match(installable, /registeredServices/);
  assert.match(installable, /(?:Do not|Never) enable dynamic registration merely to bypass the service allowlist/i);
  assert.match(installable, /do not use `make_http_request_with_x402` on an unfamiliar target/i);
  assert.match(published, /## Coinbase AgentKit/);
});


test("installable Guard skill documents the Franklin pre-sign market seam", () => {
  assert.match(installable, /## BlockRun Franklin — pre-sign market seam/);
  assert.match(installable, /src\/market\/client\.ts/);
  assert.match(installable, /immediately before `signMarketPayment`/i);
  assert.match(installable, /allowUnpaidPostProbe: true/);
  assert.match(installable, /HARD_MAX_HIRE_USD/);
  assert.match(installable, /separate \*\*\$0\.001 Guard fee\*\*/);
  assert.match(installable, /Do \*\*not\*\* generalize this to arbitrary POST targets/i);
  assert.match(installable, /not affiliated with BlockRun or Franklin/i);
});


test("installable Guard skill documents AgentBIT explicit-resource execution", () => {
  assert.match(installable, /## AgentBIT Router — explicit-resource Guard execution/);
  assert.match(installable, /POST https:\/\/agentbit\.app\/v1\/route\/execute/);
  assert.match(installable, /explicit `resource` mode/i);
  assert.match(installable, /pays AgentResolver's underlying \$0\.001 Guard charge from its treasury/i);
  assert.match(installable, /does \*\*not\*\* authorize the original target payment/i);
  assert.match(installable, /fresh, independent caller authorization/i);
  assert.match(installable, /Do not infer the original buyer's wallet identity/i);
  assert.match(installable, /not affiliated with AgentBIT/i);
});


test("installable and published Guard skills carry the network-aware MCP pre-sign gate", () => {
  for (const text of [installable, published]) {
    assert.match(text, /## MCP wallet-capable clients — fail-closed pre-sign gate/);
    assert.match(text, /onPaymentRequested/);
    assert.match(text, /hostAllowsGuardSpend/);
    assert.match(text, /mcp:\/\/tool\/payment_guard/);
    assert.match(text, /mcp:\/\/tool\/x402_payment_preflight/);
    assert.match(text, /context\.paymentRequired\.resource\.url !== expectedResource/);
    assert.match(text, /samePaymentIdentifier/);
    assert.match(text, /network\.startsWith\("eip155:"\)/);
    assert.match(text, /actual === expected/);
    assert.match(text, /Solana.*case-sensitive/is);
  }
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
