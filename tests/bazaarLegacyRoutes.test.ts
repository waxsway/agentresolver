import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migratedRoutes = [
  "hash-encode",
  "tool-contract",
  "mcp-probe",
  "agent-readiness",
  "openapi-select",
  "verified-resolve",
  "batch-verified-resolve"
] as const;

test("legacy paid routes expose Bazaar schemas and Base/Solana runtime parity", () => {
  for (const id of migratedRoutes) {
    const source = readFileSync(`src/app/api/${id}/route.ts`, "utf8");

    if (source.includes("createDeterministicPaidRoute")) {
      assert.match(
        source,
        new RegExp(`createDeterministicPaidRoute\\("${id}"`),
        `${id}: shared paid route helper`
      );
      continue;
    }

    assert.match(source, new RegExp(`paidRouteBazaarExtension\\("${id}"\\)`), `${id}: Bazaar extension`);
    assert.match(source, /registerExtension\(bazaarResourceServerExtension\)/, `${id}: Bazaar server extension`);
    assert.match(source, /ExactSvmScheme/, `${id}: Solana scheme`);
    assert.match(source, /X402_SOLANA_NETWORK/, `${id}: Solana network`);
    assert.match(source, /X402_SOLANA_PAY_TO/, `${id}: Solana payTo`);
    assert.match(source, /network: X402_NETWORK/, `${id}: Base accept`);
    assert.match(source, /network: X402_SOLANA_NETWORK/, `${id}: Solana accept`);
  }
});

test("legacy HTTP inspect publishes both input and output Bazaar schemas", () => {
  const source = readFileSync("src/app/api/http-inspect/route.ts", "utf8");

  assert.match(source, /declareDiscoveryExtension/);
  assert.match(source, /inputSchema:\s*\{/);
  assert.match(source, /output:\s*\{\s*schema:\s*\{\s*type: "object",\s*additionalProperties: true/s);
  assert.match(source, /register\(X402_SOLANA_NETWORK, new ExactSvmScheme\(\)\)/);
  assert.match(source, /registerExtension\(bazaarResourceServerExtension\)/);
});

test("generated OpenAPI identifies the operator and legal terms", () => {
  const source = readFileSync("scripts/sync-paid-products.ts", "utf8");

  assert.match(source, /contact:\s*\{\s*name: "AgentResolver",\s*url: "https:\/\/github\.com\/waxsway\/agentresolver"/s);
  assert.match(source, /termsOfService: "https:\/\/agentresolver\.vercel\.app\/legal"/);
});

test("site advertises a favicon for discovery clients", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const favicon = readFileSync("public/favicon.svg", "utf8");

  assert.match(layout, /url: "\/favicon\.svg"/);
  assert.match(favicon, /^<svg /);
});
