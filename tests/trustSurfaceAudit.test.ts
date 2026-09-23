import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/trust-surface-audit.yml", "utf8");
const preflightWorkflow = readFileSync(".github/workflows/verify-mcp-x402-preflight-funnel.yml", "utf8");

test("trust audit supplies valid Guard input before expecting a payment challenge", () => {
  assert.match(
    workflow,
    /api\/x402-payment-preflight\?url=https%3A%2F%2Fagentresolver\.vercel\.app%2Fapi%2Fx402-ping&method=GET&maxPriceUsd=0\.01&expectedNetwork=eip155%3A8453/
  );
  assert.doesNotMatch(
    workflow,
    /"\$BASE_URL\/api\/x402-payment-preflight"\)"/
  );
});

test("trust audit uses protocol-valid PayAI discovery page size", () => {
  assert.match(workflow, /--data-urlencode 'limit=100'/);
  assert.doesNotMatch(workflow, /limit=1000/);
});


test("trust audit reads extension metadata from the standard Payment-Required header", () => {
  assert.match(workflow, /payment_required=.*payment-required:/);
  assert.match(workflow, /payload\.get\("extensions", \{\}\)\.get\("bazaar"/);
  assert.match(workflow, /\/tmp\/preflight\.json/);
});

test("preflight monitor follows the dedicated buyer-setup handoff instead of stale mirrored-body metadata", () => {
  assert.match(preflightWorkflow, /x-agentresolver-buyer-setup:/);
  assert.match(preflightWorkflow, /http-x402-buyer-setup\.json/);
  assert.match(preflightWorkflow, /mode == "challenge_compact"/);
  assert.doesNotMatch(preflightWorkflow, /\.buyerSetup\.method/);
  assert.doesNotMatch(preflightWorkflow, /extensions\]\["agentresolver"\]/);
});

test("preflight monitor self-tests on main when its workflow definition changes", () => {
  assert.match(
    preflightWorkflow,
    /push:\n\s+branches: \[main\]\n\s+paths:\n\s+- '\.github\/workflows\/verify-mcp-x402-preflight-funnel\.yml'/
  );
});
