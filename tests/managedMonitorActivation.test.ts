import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

test("managed monitor paid-activation importer validates and deduplicates events", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/import-managed-monitor-activations.mjs", "--self-test"],
    { encoding: "utf8" }
  );

  assert.match(output, /"selfTest":"ok"/);
});

test("hourly managed monitoring imports paid activations before delivery", () => {
  const workflow = readFileSync(".github/workflows/managed-service-monitor.yml", "utf8");
  const paidRoute = readFileSync("src/app/api/managed-monitor-30d/route.ts", "utf8");

  assert.match(paidRoute, /managed_monitor_activation_requested/);
  assert.match(paidRoute, /billable: true/);

  assert.match(workflow, /VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  assert.match(workflow, /--query 'managed_monitor_activation_requested'/);
  assert.match(workflow, /import-managed-monitor-activations\.mjs/);
  assert.match(workflow, /--registry \.managed-monitor-state\/monitoring\/registry\.json/);
  assert.match(workflow, /git add monitoring\/registry\.json monitoring\/status/);

  const importIndex = workflow.indexOf("Import verified paid managed-monitor activations");
  const checkIndex = workflow.indexOf("Run hourly managed checks");
  assert.ok(importIndex >= 0 && checkIndex > importIndex);
});
