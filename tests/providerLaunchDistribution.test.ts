import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("provider launch distribution spans independent free commerce indexes", () => {
  const agentcash = readFileSync(".github/workflows/agentcash-register.yml", "utf8");
  const market402 = readFileSync(".github/workflows/market402-paid-probe-optin.yml", "utf8");
  const index402 = readFileSync(".github/workflows/register-provider-launch-check-402index-once.yml", "utf8");
  const aegis = readFileSync(".github/workflows/register-aegis-paid-canary-once.yml", "utf8");
  const paywitness = readFileSync(".github/workflows/register-paywitness-paid-canary-once.yml", "utf8");
  const payan = readFileSync(".github/workflows/register-payanagent-once.yml", "utf8");

  for (const source of [agentcash, market402, index402, aegis, paywitness, payan]) {
    assert.match(source, /provider-launch-check/);
  }
  assert.match(market402, /declared_price_usd:0\.05/);
  assert.match(index402, /price_usd": 0\.05/);
  assert.match(payan, /Provider Launch Check/);
});

test("seller-distribution workflows preserve zero-spend behavior", () => {
  const aegis = readFileSync(".github/workflows/register-aegis-paid-canary-once.yml", "utf8");
  const paywitness = readFileSync(".github/workflows/register-paywitness-paid-canary-once.yml", "utf8");
  assert.match(aegis, /no payment was attempted/i);
  assert.match(paywitness, /no payment was attempted/i);
});
