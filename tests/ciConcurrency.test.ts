import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("CI cancels superseded branch and main builds", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  assert.match(workflow, /group: ci-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}/);
  assert.match(workflow, /cancel-in-progress: true/);
});

test("production deploy still requires a successful current-main CI run", () => {
  const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /current_main.*VALIDATED_SHA/s);
});
