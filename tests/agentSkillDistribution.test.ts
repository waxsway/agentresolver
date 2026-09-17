import assert from "node:assert/strict";
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
