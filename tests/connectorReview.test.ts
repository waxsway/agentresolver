import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("connector review page publishes the submitted integration facts", () => {
  const page = readFileSync("src/app/connector/page.tsx", "utf8");

  for (const phrase of [
    "https://agentresolver.vercel.app/mcp",
    "No account, API key, or OAuth",
    "x402 payment authorization",
    "$0.001 USDC",
    "Base or Solana",
    "Wade Wickingson",
    "waxsway@gmail.com",
    "/privacy",
    "/terms",
    "/support"
  ]) {
    assert.ok(page.includes(phrase), `missing connector review fact: ${phrase}`);
  }
});

test("public privacy, terms, and support pages are dedicated routes", () => {
  const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");
  const terms = readFileSync("src/app/terms/page.tsx", "utf8");
  const support = readFileSync("src/app/support/page.tsx", "utf8");

  assert.match(privacy, /AgentResolver privacy policy/);
  assert.match(privacy, /does not sell personal data to advertisers/);
  assert.match(terms, /AgentResolver terms of service/);
  assert.match(terms, /does not custody customer funds/);
  assert.match(support, /waxsway@gmail\.com/);
  assert.match(support, /\.well-known\/security\.txt/);
});

test("homepage makes hosted MCP review information easy to find", () => {
  const home = readFileSync("src/app/page.tsx", "utf8");

  assert.match(home, /HOSTED MCP CONNECTOR/);
  assert.match(home, /href="\/connector"/);
  assert.match(home, /href="\/privacy"/);
  assert.match(home, /href="\/terms"/);
  assert.match(home, /href="\/support"/);
});


test("machine-readable MCP metadata matches the public connector facts", () => {
  const route = readFileSync("src/app/.well-known/mcp.json/route.ts", "utf8");

  assert.match(route, /version: "0\.1\.4"/);
  assert.match(route, /connectorInformation/);
  assert.match(route, /privacyPolicy/);
  assert.match(route, /termsOfService/);
  assert.match(route, /support/);
  assert.match(route, /solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/);
});
