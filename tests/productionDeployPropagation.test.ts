import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("production deploy smoke tolerates trust-surface propagation after the paid route flips", () => {
  const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

  assert.match(workflow, /surfaces_live=0/);
  assert.match(workflow, /for surface_attempt in \{1\.\.15\}/);
  assert.match(workflow, /cache-control: no-cache/);
  assert.match(workflow, /agentresolver-trust\.json\?deployment=\$VALIDATED_SHA&smoke=\$cache_bust/);
  assert.match(workflow, /\.deployment\.commitSha == \$sha/);
  assert.match(workflow, /sleep 2/);
  assert.match(workflow, /Canonical trust\/static surfaces did not converge/);
  assert.doesNotMatch(
    workflow,
    /curl -fsS "\$BASE_URL\/\.well-known\/agentresolver-trust\.json\?deployment=\$VALIDATED_SHA" -o \/tmp\/trust\.json\n\s+jq -e/
  );
});
