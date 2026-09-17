import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const canonical = readFileSync("skills/agentresolver-payment-guard/SKILL.md");
const published = readFileSync(
  "public/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md"
);
const index = JSON.parse(
  readFileSync("public/.well-known/agent-skills/index.json", "utf8")
);

test("well-known Agent Skills discovery mirrors the canonical Guard skill", () => {
  assert.deepEqual(published, canonical);
  assert.equal(
    index.$schema,
    "https://schemas.agentskills.io/discovery/0.2.0/schema.json"
  );
  assert.equal(index.skills.length, 1);
  assert.equal(index.skills[0].name, "agentresolver-payment-guard");
  assert.equal(index.skills[0].type, "skill-md");
  assert.equal(
    index.skills[0].url,
    "https://agentresolver.vercel.app/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md"
  );
});

test("well-known Agent Skills digest binds the exact published bytes", () => {
  const digest = createHash("sha256").update(published).digest("hex");
  assert.match(index.skills[0].digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(index.skills[0].digest, `sha256:${digest}`);
});

test("well-known Agent Skills are browser-readable and cacheable", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /source: "\/\.well-known\/agent-skills\/:path\*"/);
  assert.match(config, /Access-Control-Allow-Origin/);
  assert.match(config, /value: "\*"/);
  assert.match(config, /s-maxage=3600/);
});


test("agent discovery announcements agree with the well-known skill URL", () => {
  const agentsTxt = readFileSync("public/agents.txt", "utf8");
  const agentsJson = JSON.parse(readFileSync("public/agents.json", "utf8"));
  const config = readFileSync("next.config.ts", "utf8");
  const skillUrl =
    "https://agentresolver.vercel.app/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md";

  assert.equal(index.skills[0].url, skillUrl);
  assert.ok(agentsTxt.includes(`Skills: ${skillUrl}`));
  assert.ok(agentsTxt.includes("Agent-Skills-Index: https://agentresolver.vercel.app/.well-known/agent-skills/index.json"));
  assert.equal(agentsJson.discovery.agentSkills, "https://agentresolver.vercel.app/.well-known/agent-skills/index.json");
  assert.equal(agentsJson.skills?.[0]?.url, skillUrl);
  assert.ok(config.includes('rel=\\\"agent-skills\\\"'));
  assert.ok(config.includes("https://agentresolver.vercel.app/.well-known/agent-skills/index.json"));
});
