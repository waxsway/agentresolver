import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("provider launch is submitted to the autonomous scout ecosystem that produced a prior settlement", () => {
  const workflow = readFileSync(".github/workflows/submit-nohumans-provider-launch.yml", "utf8");
  assert.match(workflow, /nohumans\.directory\/v1\/listings/);
  assert.match(workflow, /provider-launch-check/);
  assert.match(workflow, /price_amount:0\.05/);
  assert.match(workflow, /method.*GET/s);
  assert.match(workflow, /no user funds were used/i);
});
