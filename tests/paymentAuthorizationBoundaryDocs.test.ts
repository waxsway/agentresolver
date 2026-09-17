import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public identity copy does not claim AgentResolver authorizes caller spending", () => {
  const agentsTxt = readFileSync("public/agents.txt", "utf8");
  const agentsJson = readFileSync("public/agents.json", "utf8");
  const guide = readFileSync("public/agentresolver.md", "utf8");
  const llms = readFileSync("public/llms.txt", "utf8");
  const full = readFileSync("public/llms-full.txt", "utf8");

  assert.doesNotMatch(agentsTxt, /Repeat-use x402 payment authorization/);
  assert.doesNotMatch(agentsTxt, /^# Payment authorization$/m);
  assert.doesNotMatch(agentsJson, /Repeat-use x402 payment authorization/);
  assert.doesNotMatch(guide, /^# AgentResolver — payment authorization/m);
  assert.doesNotMatch(llms, /AgentResolver Guard is a \$0\.001 USDC pre-payment authorization check/);
  assert.doesNotMatch(full, /AgentResolver is machine-native authorization and trust infrastructure/);

  assert.match(agentsTxt, /# Payment preflight/);
  assert.match(agentsJson, /verify-before-pay checks/);
  assert.match(guide, /x402 verify-before-pay/);
  assert.match(llms, /verify-before-pay check/);
  assert.match(full, /machine-native verify-before-pay infrastructure/);
});
