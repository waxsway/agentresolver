import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  ".github/workflows/x402scan-register-once.yml",
  "utf8"
);

test("x402scan registration lane is anonymous, zero-spend, and origin-only", () => {
  assert.match(
    workflow,
    /https:\/\/www\.x402scan\.com\/api\/trpc\/public\.resources\.registerFromOrigin\?batch=1/
  );
  assert.match(
    workflow,
    /"origin":"https:\/\/agentresolver\.vercel\.app"/
  );
  assert.match(workflow, /x-trpc-source: nextjs-react/);
  assert.doesNotMatch(workflow, /PAYMENT-SIGNATURE|X-PAYMENT|PRIVATE_KEY|SEED|MNEMONIC/i);
  assert.doesNotMatch(workflow, /email|contactEmail/i);
});

test("x402scan registration validates AgentResolver without inflating buyer intent", () => {
  assert.match(workflow, /x-agentresolver-internal: 1/);
  assert.match(workflow, /api\/x402-ping/);
  assert.match(workflow, /\.x402Version == 2/);
  assert.match(workflow, /\.accepts \| length/);
});

test("x402scan registration retries provider outages but fails malformed integration", () => {
  assert.match(workflow, /429\|500\|502\|503\|504\|000/);
  assert.match(workflow, /provider remained unavailable after retries/);
  assert.match(workflow, /Unexpected x402scan registration status/);
  assert.match(workflow, /\.result\.data\.json\.success == true/);
  assert.match(workflow, /tRPC registration returned an operation error/);
});

test("x402scan lane is manual-only after the successful one-time registration", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\bpush:\s*$/m);
});


test("x402scan lane suppresses credential-shaped registration response data", () => {
  assert.doesNotMatch(workflow, /cat \/tmp\/x402scan-register\.json/);
  assert.doesNotMatch(workflow, /^\s*apiKey,\s*$/m);
  assert.match(workflow, /apiKeyCount/);
  assert.match(workflow, /unexpected registration payload; body suppressed/);
  assert.match(workflow, /\.error \| \{message, data: \(\.data \| \{code, httpStatus\}\)\}/);
});
