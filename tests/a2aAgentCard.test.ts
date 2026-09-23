import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const card = JSON.parse(
  readFileSync("public/.well-known/agent-card.json", "utf8"),
) as {
  name?: string;
  description?: string;
  supportedInterfaces?: Array<{
    url?: string;
    protocolBinding?: string;
    protocolVersion?: string;
  }>;
  provider?: { organization?: string; url?: string };
  version?: string;
  documentationUrl?: string;
  capabilities?: Record<string, unknown>;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  skills?: Array<{
    id?: string;
    name?: string;
    description?: string;
    tags?: string[];
  }>;
};

test("A2A v1 Agent Card publishes truthful OpenAPI-bound AgentResolver discovery", () => {
  assert.equal(card.name, "AgentResolver");
  assert.match(card.description ?? "", /x402/i);
  assert.equal(card.provider?.organization, "AgentResolver");
  assert.equal(card.provider?.url, "https://agentresolver.vercel.app");
  assert.equal(card.version, "0.1.3");
  assert.equal(
    card.documentationUrl,
    "https://agentresolver.vercel.app/openapi.json",
  );

  assert.deepEqual(card.supportedInterfaces, [
    {
      url: "https://agentresolver.vercel.app",
      protocolBinding: "https://spec.openapis.org/oas/v3.1.0",
      protocolVersion: "3.1.0",
    },
  ]);

  const declaredBindings = (card.supportedInterfaces ?? []).map(
    (entry) => entry.protocolBinding,
  );
  for (const unsupported of ["JSONRPC", "GRPC", "HTTP+JSON"]) {
    assert.ok(
      !declaredBindings.includes(unsupported),
      `AgentResolver must not advertise unsupported A2A binding ${unsupported}`,
    );
  }

  assert.ok((card.defaultInputModes ?? []).includes("application/json"));
  assert.ok((card.defaultOutputModes ?? []).includes("application/json"));

  const skills = card.skills ?? [];
  assert.ok(skills.length >= 5);
  for (const skill of skills) {
    assert.ok(skill.id);
    assert.ok(skill.name);
    assert.ok(skill.description);
    assert.ok((skill.tags ?? []).length > 0, `${skill.id} must have discovery tags`);
  }

  const guard = skills.find(
    (skill) => skill.id === "verify-x402-payment-before-paying",
  );
  assert.ok(guard);
  assert.match(guard?.description ?? "", /\/api\/x402-payment-preflight/);
  assert.match(guard?.description ?? "", /\$0\.001 USDC/);

  const settlement = skills.find(
    (skill) => skill.id === "verify-x402-settlement-receipt",
  );
  assert.ok(settlement);
  assert.match(settlement?.description ?? "", /\/api\/x402-settlement-verify/);
});
