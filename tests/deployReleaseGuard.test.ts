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
