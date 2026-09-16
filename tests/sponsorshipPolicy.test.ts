import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const providers = readFileSync("src/app/providers/page.tsx", "utf8");
const llms = readFileSync("public/llms.txt", "utf8");
const agentDoc = readFileSync("public/agentresolver.md", "utf8");
const issueForm = readFileSync(".github/ISSUE_TEMPLATE/sponsorship.yml", "utf8");
const readme = readFileSync("README.md", "utf8");
const demandStatus = readFileSync("docs/demand-status.md", "utf8");

test("provider funnel does not publish unapproved fixed sponsorship pricing", () => {
  assert.doesNotMatch(providers, /\$\s*\d+/);
  assert.doesNotMatch(providers, /mailto:/i);
  assert.match(providers, /Applying creates no\s+purchase or financial commitment/i);
  assert.match(providers, /issues\/new\?template=sponsorship\.yml/);
  assert.doesNotMatch(readme, /\$\s*250(?:\/month|\/mo)?/i);
  assert.doesNotMatch(demandStatus, /\$\s*250(?:\/month|\/mo)?/i);
  assert.match(readme, /commercial terms.*operator approval/is);
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
