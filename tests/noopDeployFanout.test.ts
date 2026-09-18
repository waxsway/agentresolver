import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const deployFanoutWorkflows = [
  ".github/workflows/agentcash-register.yml",
  ".github/workflows/audit-payai-bazaar.yml",
  ".github/workflows/register-aegis-paid-canary-once.yml",
  ".github/workflows/register-paywitness-paid-canary-once.yml",
  ".github/workflows/register-payanagent-once.yml",
  ".github/workflows/register-agent402.yml",
  ".github/workflows/register-x402dash-trust.yml",
  ".github/workflows/audit-vet402-autonomous-buyer.yml",
  ".github/workflows/verify-mcp-x402-preflight-funnel.yml",
  ".github/workflows/submit-nohumans-payment-guard.yml",
  ".github/workflows/market402-paid-probe-optin.yml",
  ".github/workflows/production-smoke.yml",
];

test("no-op Deploy Production completion cannot fan out into marketplace and audit workers", () => {
  for (const path of deployFanoutWorkflows) {
    const workflow = readFileSync(path, "utf8");
    assert.doesNotMatch(workflow, /workflows:\s*\[?"?Deploy Production"?\]?/i, path);
    assert.doesNotMatch(workflow, /github\.event\.workflow_run/, path);
  }
});

test("production smoke remains available for real Vercel deployment events", () => {
  const workflow = readFileSync(".github/workflows/production-smoke.yml", "utf8");
  assert.match(workflow, /repository_dispatch:/);
  assert.match(workflow, /vercel\.deployment\.success/);
  assert.match(workflow, /vercel\.deployment\.promoted/);
  assert.match(workflow, /workflow_dispatch:/);
});

test("trust audit uses schedule/manual checks instead of Production Smoke fan-out", () => {
  const workflow = readFileSync(".github/workflows/trust-surface-audit.yml", "utf8");
  assert.doesNotMatch(workflow, /workflows:\s*\[?"?Production Smoke"?\]?/i);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
});

test("durable distribution retains bounded retries without release fan-out", () => {
  const agentcash = readFileSync(".github/workflows/agentcash-register.yml", "utf8");
  const aegis = readFileSync(".github/workflows/register-aegis-paid-canary-once.yml", "utf8");
  const paywitness = readFileSync(".github/workflows/register-paywitness-paid-canary-once.yml", "utf8");
  const payan = readFileSync(".github/workflows/register-payanagent-once.yml", "utf8");
  const agent402 = readFileSync(".github/workflows/register-agent402.yml", "utf8");
  const x402dash = readFileSync(".github/workflows/register-x402dash-trust.yml", "utf8");
  const vet402 = readFileSync(".github/workflows/audit-vet402-autonomous-buyer.yml", "utf8");
  const mcp = readFileSync(".github/workflows/verify-mcp-x402-preflight-funnel.yml", "utf8");
  for (const workflow of [agentcash, aegis, paywitness, payan, agent402, x402dash, vet402, mcp]) {
    assert.match(workflow, /schedule:/);
  }
});

test("no workflow is allowed to subscribe to Deploy Production completion", () => {
  for (const name of readdirSync(".github/workflows")) {
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
    const path = `.github/workflows/${name}`;
    const workflow = readFileSync(path, "utf8");
    const triggerSection = workflow.split("\npermissions:")[0];
    assert.doesNotMatch(
      triggerSection,
      /workflows:[^\n]*Deploy Production|workflows:\s*\n(?:\s*-.*\n)*\s*-\s*Deploy Production/i,
      `${path} must not fan out from Deploy Production`,
    );
  }
});
