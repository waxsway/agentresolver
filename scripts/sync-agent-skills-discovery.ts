import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const origin = "https://agentresolver.vercel.app";
const indexPath = "public/.well-known/agent-skills/index.json";

const skills = [
  {
    name: "agentresolver-payment-guard",
    canonicalPath: "skills/agentresolver-payment-guard/SKILL.md"
  },
  {
    name: "agentresolver-procurement",
    canonicalPath: "skills/agentresolver-procurement/SKILL.md"
  }
] as const;

function frontmatterField(text: string, field: string, path: string) {
  const match = text.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  if (!match) throw new Error(`Missing ${field} frontmatter in ${path}.`);
  return match[1].trim();
}

const indexEntries = skills.map((entry) => {
  const skill = readFileSync(entry.canonicalPath);
  const text = skill.toString("utf8");
  const name = frontmatterField(text, "name", entry.canonicalPath);
  const description = frontmatterField(
    text,
    "description",
    entry.canonicalPath
  );

  if (name !== entry.name) {
    throw new Error(
      `Unexpected AgentResolver skill name in ${entry.canonicalPath}: ${name}`
    );
  }

  const publicSkillPath =
    `public/.well-known/agent-skills/${entry.name}/SKILL.md`;
  mkdirSync(dirname(publicSkillPath), { recursive: true });
  writeFileSync(publicSkillPath, skill);

  const digest = createHash("sha256").update(skill).digest("hex");
  return {
    name,
    type: "skill-md",
    description,
    url: `${origin}/.well-known/agent-skills/${entry.name}/SKILL.md`,
    digest: `sha256:${digest}`
  };
});

const index = {
  $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  skills: indexEntries
};

mkdirSync(dirname(indexPath), { recursive: true });
writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
