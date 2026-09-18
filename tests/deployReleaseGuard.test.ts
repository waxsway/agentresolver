import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("production deploy guard verifies merged PR metadata, not commit-message formatting", () => {
  const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

  assert.match(workflow, /pull-requests:\s*read/);
  assert.match(workflow, /commits\/\$VALIDATED_SHA\/pulls/);
  assert.match(workflow, /\.merge_commit_sha == \$sha/);
  assert.match(workflow, /\.base\.ref == "main"/);
  assert.doesNotMatch(workflow, /git log -1 --pretty=%s/);
  assert.doesNotMatch(workflow, /accepted pull-request merge form/);
});

test("GET canary manifest copy clearly advertises the bodyless settlement path", () => {
  const publisher = readFileSync("scripts/publish-x402-get-canary.ts", "utf8");
  assert.ok(publisher.includes("No-body $0.001 x402 settlement test"));
  assert.match(publisher, /wallet, facilitator, USDC payment, and paid delivery/i);
});


test("registry-only metadata does not force an application deploy", () => {
  const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");
  assert.match(workflow, /package-lock\.json\|server\.json\) ;;/);
});

test("PayAI Bazaar audit follows generated paid discovery surfaces", () => {
  const workflow = readFileSync(".github/workflows/audit-payai-bazaar.yml", "utf8");
  for (const path of [
    "public/openapi.json",
    "public/capabilities.json",
    "public/integrations.json",
    "public/.well-known/x402",
    "public/.well-known/x402-catalog.json",
    "public/.well-known/x402-service.json"
  ]) {
    assert.ok(workflow.includes(path), `missing PayAI audit trigger: ${path}`);
  }
});


test("PayAI Bazaar audit uses protocol-valid pagination", () => {
  const workflow = readFileSync(".github/workflows/audit-payai-bazaar.yml", "utf8");
  assert.match(workflow, /limit = 100\b/);
  assert.doesNotMatch(workflow, /limit = 1000\b/);
});


test("production deploy classifies the full drift from live production to validated main", () => {
  const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

  assert.match(
    workflow,
    /api\/x402-payment-preflight\?url=https%3A%2F%2Fexample\.com%2Fpaid&method=GET&maxPriceUsd=0\.01/
  );
  assert.match(workflow, /x-agentresolver-deployment/);
  assert.match(workflow, /production_sha="\$candidate"/);
  assert.match(workflow, /git fetch --no-tags --depth=1 origin "\$production_sha"/);
  assert.match(workflow, /git diff --name-only "\$production_sha" "\$VALIDATED_SHA"/);
  assert.match(workflow, /no application drift from canonical production/i);
  assert.doesNotMatch(workflow, /pulls\/\$RELEASE_PR_NUMBER\/files\?per_page=100&page=\$page/);
});

test("production drift detection fails closed when the live deployment SHA is unavailable", () => {
  const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

  assert.match(workflow, /if \[ -z "\$production_sha" \]; then/);
  assert.match(workflow, /refusing to guess deployment drift/i);
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
});


test("production deploy coalesces rapid main changes before spending Vercel build CPU", () => {
  const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

  assert.match(workflow, /Waiting 90 seconds to coalesce rapid application merges/);
  assert.match(workflow, /sleep 90/);
  assert.match(workflow, /current_main_after_coalesce/);
  assert.match(workflow, /Skipping stale CI result immediately/);
  assert.match(workflow, /Skipping superseded release/);
});

test("production drift ignores repository-only docs but not dependency lock changes", () => {
  const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

  assert.match(workflow, /tests\/\*\|docs\/\*\|README\.md\|AGENTS\.md/);
  assert.doesNotMatch(workflow, /package-lock\.json\|server\.json/);
});
