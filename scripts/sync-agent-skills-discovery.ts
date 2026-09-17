import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const canonicalPath = "skills/agentresolver-payment-guard/SKILL.md";
const publicSkillPath =
  "public/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md";
const indexPath = "public/.well-known/agent-skills/index.json";

const skill = readFileSync(canonicalPath);
const text = skill.toString("utf8");

function frontmatterField(field: string) {
  const match = text.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  if (!match) throw new Error(`Missing ${field} frontmatter in ${canonicalPath}.`);
  return match[1].trim();
}

const name = frontmatterField("name");
const description = frontmatterField("description");
if (name !== "agentresolver-payment-guard") {
  throw new Error(`Unexpected AgentResolver skill name: ${name}`);
}

mkdirSync(dirname(publicSkillPath), { recursive: true });
writeFileSync(publicSkillPath, skill);

const digest = createHash("sha256").update(skill).digest("hex");
const index = {
  $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  skills: [
    {
      name,
      type: "skill-md",
      description,
      url: "/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md",
      digest: `sha256:${digest}`
    }
  ]
};

mkdirSync(dirname(indexPath), { recursive: true });
writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
