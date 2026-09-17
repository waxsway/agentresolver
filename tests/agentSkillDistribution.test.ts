import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const installable = readFileSync("skills/agentresolver-payment-guard/SKILL.md", "utf8");
const published = readFileSync("public/skill.md", "utf8");

test("repository exposes an installable AgentResolver payment Guard skill", () => {
  assert.match(installable, /^---\nname: agentresolver-payment-guard\n/m);
  assert.match(installable, /description: .*x402 payment terms/i);
  assert.match(installable, /GET https:\/\/agentresolver\.vercel\.app\/api\/payment-guard\?url=/);
  assert.match(installable, /\$0\.001 USDC/);
  assert.match(installable, /api\/x402-client-setup/);
  assert.match(installable, /before each autonomous x402 spend/i);
  assert.match(installable, /eligible.*does not authorize spending/is);
  assert.match(installable, /caller-owned signer/i);
});

test("published skill mirrors the current GET-first Guard contract", () => {
  assert.match(published, /^---\nname: agentresolver-payment-guard\n/m);
  assert.match(published, /GET https:\/\/agentresolver\.vercel\.app\/api\/payment-guard\?url=/);
  assert.match(published, /GET \/api\/x402-payment-preflight/);
  assert.match(published, /POST remains available/i);
  assert.match(published, /api\/x402-client-setup/);
  assert.match(published, /eip155:8453/);
  assert.match(published, /solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/);
  assert.match(published, /eligible.*does not authorize spending/is);
  assert.doesNotMatch(
    published,
    /Canonical paid verification route:\s*`POST https:\/\/agentresolver\.vercel\.app\/api\/x402-payment-preflight`/
  );
});

test("web-native Agent Skills discovery is generated from the canonical skill", () => {
  const wellKnown = readFileSync(
    "public/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md",
    "utf8"
  );
  const index = JSON.parse(
    readFileSync("public/.well-known/agent-skills/index.json", "utf8")
  );
  const expectedDigest =
    `sha256:${createHash("sha256").update(Buffer.from(wellKnown)).digest("hex")}`;

  assert.equal(wellKnown, installable);
  assert.equal(index.$schema, "https://schemas.agentskills.io/discovery/0.2.0/schema.json");
  assert.equal(index.skills.length, 1);
  assert.deepEqual(index.skills[0], {
    name: "agentresolver-payment-guard",
    type: "skill-md",
    description: installable.match(/^description:\s*(.+)$/m)?.[1]?.trim(),
    url: "https://agentresolver.vercel.app/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md",
    digest: expectedDigest
  });
});

test("agent discovery surfaces advertise the installable Guard skill", () => {
  const agentsTxt = readFileSync("public/agents.txt", "utf8");
  const agentsJson = JSON.parse(readFileSync("public/agents.json", "utf8"));
  const nextConfig = readFileSync("next.config.ts", "utf8");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const skillUrl =
    "https://agentresolver.vercel.app/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md";

  assert.ok(agentsTxt.includes(`Skills: ${skillUrl}`));
  assert.equal(
    agentsJson.discovery.agentSkills,
    "https://agentresolver.vercel.app/.well-known/agent-skills/index.json"
  );
  assert.equal(agentsJson.skills?.[0]?.url, skillUrl);
  assert.ok(nextConfig.includes('rel=\\\"agent-skills\\\"'));
  assert.ok(nextConfig.includes('source: "/.well-known/agent-skills/:path*"'));
  assert.match(packageJson.scripts["sync:products"], /publish-agent-skills\.ts/);
});
