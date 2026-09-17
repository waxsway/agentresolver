import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("SkillsIndex submission positions the current Guard product without identity or spend", () => {
  const workflow = readFileSync(".github/workflows/submit-skillsindex-once.yml", "utf8");
  assert.match(workflow, /Submit AgentResolver Guard to SkillsIndex/);
  assert.match(workflow, /\$0\.001 USDC x402 verify-before-pay Guard/);
  assert.match(workflow, /installable Agent Skill/);
  assert.match(workflow, /https:\/\/github\.com\/waxsway\/agentresolver/);
  assert.doesNotMatch(workflow, /email/i);
  assert.doesNotMatch(workflow, /payment-signature/i);
  assert.doesNotMatch(workflow, /private.?key/i);
});
