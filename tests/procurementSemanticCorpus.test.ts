import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateProcurementCandidate,
  type ProcurementCandidate
} from "../src/lib/procurement";

const base: ProcurementCandidate = {
  id: "candidate",
  source: "semantic-corpus",
  sourceRank: 1,
  name: "Candidate",
  description: null,
  endpoint: "https://example.com/mcp",
  protocol: "mcp",
  priceUsd: null,
  networks: [],
  inputSchema: null,
  outputSchema: null,
  sideEffect: "unknown",
  auth: "unknown",
  execute: null,
  evidence: null
};

const passing = [
  {
    goal: "search public web for recent company news",
    name: "Web Search",
    description: "Search the public web for current company news and information"
  },
  {
    goal: "convert usd to eur currency amount",
    name: "Currency Converter",
    description: "Convert USD to EUR currency amounts using exchange rates"
  },
  {
    goal: "send transactional email to customer",
    name: "Transactional Email Sender",
    description: "Send transactional email messages to recipients"
  },
  {
    goal: "take screenshot of web page",
    name: "Browser Screenshot",
    description: "Take screenshots of web pages in a browser"
  },
  {
    goal: "persistent browser workspace with named tabs and human takeover",
    name: "Persistent Browser Workspace",
    description: "Persistent browser workspace with named tabs and human takeover"
  },
  {
    goal: "weather",
    name: "Weather Forecast",
    description: "Current weather and forecast data"
  }
] as const;

const failing = [
  {
    goal: "persistent local browser workspace with named tabs and human takeover",
    name: "Anybrowse",
    description: "URL-to-Markdown scraping"
  },
  {
    goal: "persistent local browser workspace with named tabs and human takeover",
    name: "Persistent Browser Workspace",
    description: "Persistent browser workspace for browser automation"
  },
  {
    goal: "send transactional email to customer",
    name: "SMS Gateway",
    description: "Send SMS text messages to phone numbers"
  },
  {
    goal: "search public web for company news",
    name: "Database Backup",
    description: "Create and restore encrypted database backups"
  },
  {
    goal: "query postgres database records",
    name: "PDF Extractor",
    description: "Extract text and tables from PDF documents"
  },
  {
    goal: "summarize pdf document",
    name: "PDF Converter",
    description: "Convert PDF files to Markdown"
  },
  {
    goal: "browser",
    name: "Anybrowse",
    description: "URL-to-Markdown scraping"
  }
] as const;

test("semantic evidence accepts representative capability matches", () => {
  for (const item of passing) {
    const result = evaluateProcurementCandidate(
      { ...base, name: item.name, description: item.description },
      { protocol: "mcp", requireHttps: true },
      item.goal
    );
    assert.equal(
      result.semanticMatch?.proven,
      true,
      `expected semantic match for: ${item.goal} -> ${item.name}`
    );
    assert.ok(!result.unknownConstraints.includes("semantic_capability"));
  }
});

test("semantic evidence fails closed on representative category lookalikes", () => {
  for (const item of failing) {
    const result = evaluateProcurementCandidate(
      { ...base, name: item.name, description: item.description },
      { protocol: "mcp", requireHttps: true },
      item.goal
    );
    assert.equal(
      result.semanticMatch?.proven,
      false,
      `expected semantic uncertainty for: ${item.goal} -> ${item.name}`
    );
    assert.ok(result.unknownConstraints.includes("semantic_capability"));
  }
});

test("semantic evidence requires high-signal lifecycle qualifiers, not only broad token coverage", () => {
  const result = evaluateProcurementCandidate(
    {
      ...base,
      name: "Persistent Browser Workspace",
      description: "Persistent browser workspace for browser automation"
    },
    { protocol: "mcp", requireHttps: true },
    "persistent local browser workspace with named tabs and human takeover"
  );

  assert.equal(result.semanticMatch?.matchedTokens.length, 3);
  assert.ok((result.semanticMatch?.requiredQualifierTokens.length ?? 0) >= 5);
  assert.ok(
    (result.semanticMatch?.matchedQualifierTokens.length ?? 0) <
      (result.semanticMatch?.qualifierMinimumMatches ?? 0)
  );
  assert.equal(result.semanticMatch?.proven, false);
  assert.ok(result.unknownConstraints.includes("semantic_capability"));
});
