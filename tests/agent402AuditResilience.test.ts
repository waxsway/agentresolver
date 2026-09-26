import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/register-agent402.yml", "utf8");

test("Agent402 ranking audit retries transient upstream failures without aborting seller refresh", () => {
  assert.match(workflow, /for attempt in 1 2 3/);
  assert.match(workflow, /route_ok=false/);
  assert.match(workflow, /status\\":\\"upstream_unavailable/);
  assert.match(workflow, /continue/);
});
