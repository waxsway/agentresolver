import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const canonical = readFileSync("skills/agentresolver-payment-guard/SKILL.md");
const published = readFileSync(
  "public/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md"
);
const procurementCanonical = readFileSync(
  "skills/agentresolver-procurement/SKILL.md"
);
const procurementPublished = readFileSync(
  "public/.well-known/agent-skills/agentresolver-procurement/SKILL.md"
);
const providerCanonical = readFileSync(
  "skills/agentresolver-provider/SKILL.md"
);
const providerPublished = readFileSync(
  "public/.well-known/agent-skills/agentresolver-provider/SKILL.md"
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
  assert.equal(index.skills.length, 3);
  assert.equal(index.skills[0].name, "agentresolver-payment-guard");
  assert.equal(index.skills[1].name, "agentresolver-procurement");
  assert.equal(index.skills[2].name, "agentresolver-provider");
  assert.deepEqual(procurementPublished, procurementCanonical);
  assert.deepEqual(providerPublished, providerCanonical);
  assert.equal(index.skills[0].type, "skill-md");
  assert.equal(
    index.skills[0].url,
    "https://agentresolver.vercel.app/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md"
  );
});

test("well-known Agent Skills digests bind the exact published bytes", () => {
  const guardDigest = createHash("sha256").update(published).digest("hex");
  const procurementDigest = createHash("sha256")
    .update(procurementPublished)
    .digest("hex");
  const providerDigest = createHash("sha256")
    .update(providerPublished)
    .digest("hex");
  assert.match(index.skills[0].digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(index.skills[0].digest, `sha256:${guardDigest}`);
  assert.match(index.skills[1].digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(index.skills[1].digest, `sha256:${procurementDigest}`);
  assert.match(index.skills[2].digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(index.skills[2].digest, `sha256:${providerDigest}`);
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

test("procurement skill is a free non-custodial fallback contract", () => {
  const text = procurementPublished.toString("utf8");
  assert.match(text, /name: agentresolver-procurement/);
  assert.match(text, /POST https:\/\/agentresolver\.vercel\.app\/api\/procure/);
  assert.match(text, /Procurement itself is free/i);
  assert.match(text, /x-agentresolver-attribution-id/);
  assert.match(text, /2% provider-funded success fee/i);
  assert.match(text, /never[\s\S]*private key/i);
});


test("provider skill is a zero-account verified-commerce contract", () => {
  const text = providerPublished.toString("utf8");
  assert.match(text, /name: agentresolver-provider/);
  assert.match(text, /provider_bootstrap/);
  assert.match(text, /providerOrigins/);
  assert.match(text, /x-agentresolver-attribution-id/);
  assert.match(text, /x-agentresolver-attribution-receipt/);
  assert.match(text, /provider-attribution-verify/);
  assert.match(text, /provider-success-fee-verify/);
  assert.match(text, /2% of independently verified routed GMV/i);
  assert.match(text, /does \*\*not\*\* send this request/i);
  assert.doesNotMatch(text, /private key or seed phrase.*AgentResolver.*required/i);
});
