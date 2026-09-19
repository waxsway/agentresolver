import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync(
  "scripts/provision-attribution-signing-secret.sh",
  "utf8"
);

test("attribution signer provisioning is explicitly gated and inert by default", () => {
  assert.match(
    script,
    /ALLOW_ATTRIBUTION_SECRET_PROVISION:-.*!= "1"/
  );
  assert.match(script, /exit 2/);
  assert.doesNotMatch(script, /vercel env (?:update|rm)/);
});

test("provisioning generates a fresh dedicated sensitive secret rather than reusing payment credentials", () => {
  assert.match(
    script,
    /KEY="AGENTRESOLVER_ATTRIBUTION_SIGNING_SECRET"/
  );
  assert.match(script, /openssl rand -hex 32/);
  assert.match(script, /vercel env add "\$KEY" "\$TARGET" --sensitive/);
  assert.doesNotMatch(
    script,
    /CDP_API|PRIVATE_KEY|WALLET|FACILITATOR.*SECRET|AGENTRESOLVER_PAY_TO/
  );
});

test("provisioning leaves an existing signing secret unchanged", () => {
  assert.match(script, /vercel env ls "\$TARGET"/);
  assert.match(script, /already exists for \$TARGET; leaving it unchanged/);
  assert.match(script, /exit 0/);
});

test("provisioning never prints the generated secret or failed CLI output", () => {
  assert.doesNotMatch(script, /set -x/);
  assert.doesNotMatch(script, /echo .*\$secret/);
  assert.doesNotMatch(script, /printf .*\$secret.*>&2/);
  assert.match(script, /output suppressed/);
  assert.doesNotMatch(script, /cat .*result_file/);
});

test("provisioning requires the exact Vercel project binding and redeploys separately", () => {
  assert.match(script, /VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID/);
  assert.match(script, /\.vercel\/project\.json/);
  assert.match(script, /Redeploy is required before runtime signing becomes active/);
  assert.doesNotMatch(script, /vercel deploy/);
});
