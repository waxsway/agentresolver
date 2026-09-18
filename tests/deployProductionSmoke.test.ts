import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

test("production payment smoke supplies valid preflight input before expecting 402", () => {
  assert.match(
    workflow,
    /api\/x402-payment-preflight\?url=https%3A%2F%2Fexample\.com%2Fpaid&method=GET&maxPriceUsd=0\.01/
  );
  assert.doesNotMatch(
    workflow,
    /-w '%\{http_code\}' "\$BASE_URL\/api\/x402-payment-preflight" \|\| true/
  );
  assert.match(workflow, /\[ "\$code" = "402" \]/);
});


test("production smoke locks a signable Base and Solana x402 canary challenge", () => {
  const productionSmoke = readFileSync(".github/workflows/production-smoke.yml", "utf8");
  assert.match(productionSmoke, /x402-ping PAYMENT-REQUIRED header missing/);
  assert.match(productionSmoke, /resource\.get\("url"\) == "https:\/\/agentresolver\.vercel\.app\/api\/x402-ping"/);
  assert.match(productionSmoke, /eip155:8453/);
  assert.match(productionSmoke, /0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/);
  assert.match(productionSmoke, /0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8/);
  assert.match(productionSmoke, /solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/);
  assert.match(productionSmoke, /EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/);
  assert.match(productionSmoke, /AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa/);
  assert.match(productionSmoke, /feePayer/);
});


test("production deploy smoke retries trust surfaces after payment alias convergence", () => {
  assert.match(workflow, /contracts_ready=0/);
  assert.match(workflow, /for attempt in \{1\.\.15\}; do/);
  assert.match(workflow, /smokeAttempt=\$attempt/);
  assert.match(workflow, /cache-control: no-cache/);
  assert.match(workflow, /\.deployment\.commitSha == \$sha/);
  assert.match(workflow, /if \[ "\$contracts_ready" != "1" \]; then/);
  assert.match(workflow, /trust\/health\/security surfaces did not converge/i);
});


test("production deploy preflight probes are marked internal", () => {
  const occurrences = workflow.match(/x-agentresolver-internal: 1/g) ?? [];
  assert.ok(occurrences.length >= 2, "deploy drift and post-deploy probes must both be internal");
  assert.match(
    workflow,
    /-H 'x-agentresolver-internal: 1' \\\n\s+"\$BASE_URL\/api\/x402-payment-preflight\?url=/
  );
  assert.match(
    workflow,
    /-w '%\{http_code\}' -H 'x-agentresolver-internal: 1' "\$BASE_URL\/api\/x402-payment-preflight\?url=/
  );
});


test("production drift probe keeps command substitution quoted", () => {
  assert.match(
    workflow,
    /"\$BASE_URL\/api\/x402-payment-preflight\?url=https%3A%2F%2Fexample\.com%2Fpaid&method=GET&maxPriceUsd=0\.01" \|\| true\)"/
  );
  assert.doesNotMatch(
    workflow,
    /"\$BASE_URL\/api\/x402-payment-preflight\?url=https%3A%2F%2Fexample\.com%2Fpaid&method=GET&maxPriceUsd=0\.01" \|\| true\)\n/
  );
});
