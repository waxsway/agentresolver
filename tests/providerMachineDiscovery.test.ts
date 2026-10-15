import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const docs = [
  "public/llms.txt",
  "public/llms-full.txt",
  "public/agentresolver.md"
].map((path) => readFileSync(path, "utf8"));

test("machine docs expose self-serve provider enrollment and success-fee economics", () => {
  for (const content of docs) {
    assert.match(content, /self-serve provider network/i);
    assert.match(content, /api\/provider-bootstrap/);
    assert.match(content, /provider-onboarding\.md/);
    assert.match(content, /provider-integration\.json/);
    assert.match(content, /2% of verified routed GMV/);
    assert.match(content, /minimum success fee: \*\*\$0\.001 USDC\*\*/);
    assert.match(content, /buyer extra fee from AgentResolver: \*\*\$0\*\*/);
    assert.match(content, /without an AgentResolver account, email, API key, operator review/i);
  }
});
