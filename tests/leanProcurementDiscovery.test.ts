import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const lean = "https://agentresolver.vercel.app/mcp/control";
const full = "https://agentresolver.vercel.app/mcp";

test("machine discovery defaults lean while the official registry exposes the paid Guard surface", () => {
  const integrations = JSON.parse(readFileSync("public/integrations.json", "utf8"));
  const agents = JSON.parse(readFileSync("public/agents.json", "utf8"));
  const server = JSON.parse(readFileSync("server.json", "utf8"));
  const agentsTxt = readFileSync("public/agents.txt", "utf8");
  const skill = readFileSync(
    "skills/agentresolver-procurement/SKILL.md",
    "utf8"
  );
  const publishedSkill = readFileSync(
    "public/.well-known/agent-skills/agentresolver-procurement/SKILL.md",
    "utf8"
  );

  assert.equal(integrations.mcp.url, lean);
  assert.equal(integrations.mcp.fullCompatibilityUrl, full);
  assert.equal(integrations.configs.portableMcp.servers.agentresolver.url, lean);
  assert.equal(integrations.configs.vscode.servers.agentresolver.url, lean);
  assert.equal(agents.discovery.mcp, lean);
  assert.equal(agents.discovery.mcpFullCompatibility, full);
  assert.equal(server.remotes[0].url, full);
  assert.ok(agentsTxt.includes(`MCP: ${lean}`));
  assert.ok(agentsTxt.includes(`MCP-Full-Compatibility: ${full}`));
  assert.ok(skill.includes(lean));
  assert.ok(skill.includes(full));
  assert.equal(publishedSkill, skill);
});
