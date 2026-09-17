import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const llms = readFileSync("public/llms.txt", "utf8");
const full = readFileSync("public/llms-full.txt", "utf8");
const guide = readFileSync("public/agentresolver.md", "utf8");

test("machine docs make AgentResolver Guard GET-first and repeat-use", () => {
  for (const text of [llms, full, guide]) {
    assert.match(text, /AgentResolver Guard/);
    assert.match(text, /api\/payment-guard/);
    assert.match(text, /GET/);
    assert.match(text, /caller/i);
    assert.match(text, /authoriz/i);
  }

  assert.match(llms, /before (?:each|the next) .*x402 spend/i);
  assert.match(full, /before each autonomous payment/i);
  assert.match(guide, /target 402.*Guard.*caller authorization.*target signed retry/is);
});

test("machine docs expose the payment-capable buyer handoff", () => {
  for (const text of [llms, full, guide]) {
    assert.match(text, /api\/x402-client-setup/);
    assert.match(text, /@x402\/fetch/);
    assert.match(text, /@x402\/mcp/);
  }
});

test("MCP docs advertise payment_guard and preserve free resolve", () => {
  for (const text of [llms, full, guide]) {
    assert.match(text, /payment_guard/);
    assert.match(text, /resolve/);
  }
});

test("short machine instructions no longer tell buyers to use POST as the primary preflight path", () => {
  assert.doesNotMatch(
    llms,
    /Before authorizing USDC, call POST https:\/\/agentresolver\.vercel\.app\/api\/x402-payment-preflight/
  );
  assert.match(
    llms,
    /GET https:\/\/agentresolver\.vercel\.app\/api\/payment-guard\?url=/
  );
  assert.match(llms, /POST remains supported/i);
});
