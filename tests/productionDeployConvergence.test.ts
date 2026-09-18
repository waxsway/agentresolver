import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("production deploy retries supporting trust surfaces after payment-route convergence", () => {
  const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");
  assert.match(workflow, /surfaces_live=0/);
  assert.match(workflow, /for attempt in \{1\.\.30\}; do/);
  assert.match(workflow, /health_ok=0/);
  assert.match(workflow, /trust_ok=0/);
  assert.match(workflow, /security_ok=0/);
  assert.match(workflow, /\.deployment\.commitSha == \$sha/);
  assert.match(workflow, /if \[ "\$health_ok" = "1" \] && \[ "\$trust_ok" = "1" \] && \[ "\$security_ok" = "1" \]/);
  assert.match(workflow, /supporting trust surfaces did not converge in time/);
});
