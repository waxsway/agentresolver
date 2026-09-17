import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../src/app/.well-known/nohumans-claim/route";

test("NoHumans claim route stays closed without a claim token", async () => {
  const prior = process.env.NOHUMANS_CLAIM_TOKEN;
  delete process.env.NOHUMANS_CLAIM_TOKEN;
  try {
    const response = await GET();
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "Not configured\n");
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    if (prior === undefined) delete process.env.NOHUMANS_CLAIM_TOKEN;
    else process.env.NOHUMANS_CLAIM_TOKEN = prior;
  }
});

test("NoHumans claim route serves only the configured one-time token", async () => {
  const prior = process.env.NOHUMANS_CLAIM_TOKEN;
  process.env.NOHUMANS_CLAIM_TOKEN = "claim-token-example";
  try {
    const response = await GET();
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "claim-token-example");
    assert.match(response.headers.get("content-type") ?? "", /^text\/plain/);
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    if (prior === undefined) delete process.env.NOHUMANS_CLAIM_TOKEN;
    else process.env.NOHUMANS_CLAIM_TOKEN = prior;
  }
});
