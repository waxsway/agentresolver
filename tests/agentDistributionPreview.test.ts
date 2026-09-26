import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildAgentDistributionPreview } from "../src/lib/agentDistributionPreview";

test("free distribution preview proves seller-specific gaps without giving away paid artifacts", () => {
  const preview = buildAgentDistributionPreview({
    target: "https://api.example.com/",
    score: 55,
    grade: "D",
    checks: [
      { id: "homepage", ok: true, status: 200, url: "https://api.example.com/", note: "Homepage reachable." },
      { id: "llms", ok: false, status: 404, url: "https://api.example.com/llms.txt", note: "Not found or unreachable." },
      { id: "openapi", ok: false, status: 404, url: "https://api.example.com/openapi.json", note: "Not found or unreachable." },
      { id: "mcp-card", ok: false, status: 404, url: "https://api.example.com/mcp/server-card", note: "Not found or unreachable." },
      { id: "sitemap", ok: false, status: 404, url: "https://api.example.com/sitemap.xml", note: "Not found or unreachable." }
    ],
    issues: [],
    recommendations: [
      "Publish /llms.txt with concise machine-readable service instructions.",
      "Publish /openapi.json for callable HTTP capabilities.",
      "Publish /sitemap.xml so discovery surfaces are crawlable."
    ]
  });

  assert.equal(preview.paid, false);
  assert.equal(preview.preview, true);
  assert.equal(preview.readiness.missingSurfaceCount, 4);
  assert.equal(preview.topGaps.length, 3);
  assert.equal(preview.nextActions.length, 2);
  assert.equal(preview.upgrade.priceUsd, 5);
  assert.match(preview.upgrade.reason, /files to ship/i);
  assert.equal("artifacts" in preview, false);
  assert.equal("launchSequence" in preview, false);
});

test("distribution page exposes the free preview before the paid CTA", () => {
  const source = readFileSync("src/app/distribution/page.tsx", "utf8");
  const previewIndex = source.indexOf("/api/agent-distribution-preview");
  const paidIndex = source.indexOf("See the $5 USDC quote");

  assert.ok(previewIndex >= 0);
  assert.ok(paidIndex > previewIndex);
  assert.match(source, /Preview my distribution gaps — free/);
});
