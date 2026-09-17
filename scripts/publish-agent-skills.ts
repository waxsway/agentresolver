import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const origin = "https://agentresolver.vercel.app";
const sourcePath = "skills/agentresolver-payment-guard/SKILL.md";
const publishedPath = "public/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md";
const indexPath = "public/.well-known/agent-skills/index.json";

const source = readFileSync(sourcePath);
const markdown = source.toString("utf8");
const name = markdown.match(/^name:\s*(.+)$/m)?.[1]?.trim();
const description = markdown.match(/^description:\s*(.+)$/m)?.[1]?.trim();

if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
  throw new Error("Agent Skill is missing a valid kebab-case name.");
}
if (!description) {
  throw new Error("Agent Skill is missing a description.");
}

mkdirSync(dirname(publishedPath), { recursive: true });
writeFileSync(publishedPath, source);

const digest = createHash("sha256").update(source).digest("hex");
const skillUrl = `${origin}/.well-known/agent-skills/${name}/SKILL.md`;

const index = {
  $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  skills: [
    {
      name,
      type: "skill-md",
      description,
      url: skillUrl,
      digest: `sha256:${digest}`
    }
  ]
};

mkdirSync(dirname(indexPath), { recursive: true });
writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
