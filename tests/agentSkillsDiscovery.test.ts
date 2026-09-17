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
    "/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md"
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
