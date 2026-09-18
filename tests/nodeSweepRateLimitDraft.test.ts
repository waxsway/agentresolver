import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/stage-node-sweep-rate-limit.yml", "utf8");

test("crawler cost guard stages a signer-safe log-only draft and never publishes", () => {
  assert.match(workflow, /user_agent","op":"eq","value":"node"/);
  assert.match(workflow, /PAYMENT-SIGNATURE","op":"nex"/);
  assert.match(workflow, /"\/api\/"/);
  assert.match(workflow, /--rate-limit-window 60/);
  assert.match(workflow, /--rate-limit-requests 120/);
  assert.match(workflow, /--rate-limit-keys ip/);
  assert.match(workflow, /--rate-limit-action log/);
  assert.match(workflow, /vercel@48\.8\.0/);
  assert.match(workflow, /Draft only/);
  assert.doesNotMatch(workflow, /^\s*vercel firewall publish\b/m);
});
