import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const providers = readFileSync("src/app/providers/page.tsx", "utf8");
const llms = readFileSync("public/llms.txt", "utf8");
const agentDoc = readFileSync("public/agentresolver.md", "utf8");
const issueForm = readFileSync(".github/ISSUE_TEMPLATE/sponsorship.yml", "utf8");

test("provider commerce pricing is not presented as paid sponsorship", () => {
  // Provider success-fee economics may be public. Sponsorship pricing remains
  // separate, inquiry-only inventory and must not be smuggled into this funnel.
  assert.match(providers, /success fee is 2%/i);
  assert.match(providers, /\$0\.001 minimum/i);
  assert.doesNotMatch(providers, /sponsored placement/i);
  assert.doesNotMatch(providers, /sponsorship price/i);
  assert.doesNotMatch(providers, /mailto:/i);
});

test("machine docs disclose sponsorship without changing organic ranking", () => {
  assert.match(llms, /Organic ranking remains free and independent/i);
  assert.match(llms, /inquiry only/i);
  assert.match(agentDoc, /do(?:es)? not alter organic ranking/i);
  assert.match(agentDoc, /does not create a purchase/i);
});

test("sponsorship intake itself is inquiry-only and disclosure-required", () => {
  assert.match(issueForm, /inquiry only/i);
  assert.match(issueForm, /explicitly labeled/i);
  assert.match(issueForm, /will not alter AgentResolver's organic ranking/i);
});
