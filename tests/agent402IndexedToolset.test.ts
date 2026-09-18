import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow=readFileSync(".github/workflows/register-agent402.yml","utf8");

test("Agent402 workflow audits the exact indexed AgentResolver tools",()=>{
  assert.match(workflow,/Audit Agent402 indexed AgentResolver toolset/);
  assert.match(workflow,/https:\/\/agent402\.tools\/api\/index/);
  assert.match(workflow,/row\.get\("origin"\) == "https:\/\/agentresolver\.vercel\.app"/);
  assert.match(workflow,/"tools":\[\{/);
  assert.doesNotMatch(workflow,/PAYMENT-SIGNATURE|X-PAYMENT/);
});
