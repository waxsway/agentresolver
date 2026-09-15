export type Capability = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  priceUsd: number;
  mode: "owned" | "partner" | "discovery";
  status: "live" | "planned";
  endpoint?: string;
  payment?: {
    protocol: "x402";
    scheme: "exact";
    network: string;
    asset: string;
  };
};

export const CAPABILITIES: Capability[] = [
  {
    id: "capability-search",
    name: "Capability Search",
    description: "Find the best external tool, API, MCP server, or machine service for a goal.",
    tags: ["tool discovery", "api discovery", "mcp", "x402", "routing", "search"],
    priceUsd: 0,
    mode: "owned",
    status: "live",
    endpoint: "/api/resolve"
  },
  {
    id: "batch-verified-resolve",
    name: "Batch Verified Resolve",
    description:
      "Resolve and live-verify up to four capability requests in one batch, probing up to two MCP candidates per request and returning recommendations with evidence.",
    tags: [
      "batch verified resolve",
      "batch verification",
      "tool procurement",
      "agent procurement",
      "mcp verification",
      "capability verification",
      "tool selection",
      "provider selection",
      "multi tool",
      "recommendation",
      "x402"
    ],
    priceUsd: 1,
    mode: "owned",
    status: "live",
    endpoint: "/api/batch-verified-resolve",
    payment: {
      protocol: "x402",
      scheme: "exact",
      network: "eip155:8453",
      asset: "USDC"
    }
  },
  {
    id: "verified-resolve",
    name: "Verified Resolve",
    description:
      "Resolve a missing capability, live-probe up to two top MCP candidates, and return a recommendation with verification evidence.",
    tags: [
      "verified resolve",
      "verified tool",
      "tool verification",
      "mcp verification",
      "capability verification",
      "tool selection",
      "provider selection",
      "live check",
      "recommendation",
      "x402"
    ],
    priceUsd: 0.25,
    mode: "owned",
    status: "live",
    endpoint: "/api/verified-resolve",
    payment: {
      protocol: "x402",
      scheme: "exact",
      network: "eip155:8453",
      asset: "USDC"
    }
  },
  {
    id: "mcp-probe",
    name: "MCP Probe",
    description:
      "Verify a remote MCP endpoint is alive and inspect compatibility, latency, server metadata, and tool inventory before connecting.",
    tags: [
      "mcp probe",
      "mcp health",
      "mcp server",
      "mcp endpoint",
      "verify mcp",
      "test mcp",
      "tools list",
      "compatibility",
      "latency",
      "server check",
      "x402"
    ],
    priceUsd: 0.01,
    mode: "owned",
    status: "live",
    endpoint: "/api/mcp-probe",
    payment: {
      protocol: "x402",
      scheme: "exact",
      network: "eip155:8453",
      asset: "USDC"
    }
  },
  {
    id: "agent-readiness",
    name: "Agent Readiness Audit",
    description:
      "Audit a public website for agent discoverability, llms.txt, ARD, OpenAPI, sitemap, MCP metadata, and baseline headers.",
    tags: [
      "agent readiness",
      "agent accessibility",
      "llms.txt",
      "ard",
      "openapi",
      "mcp",
      "robots",
      "sitemap",
      "website audit",
      "domain",
      "x402"
    ],
    priceUsd: 0.05,
    mode: "owned",
    status: "live",
    endpoint: "/api/agent-readiness",
    payment: {
      protocol: "x402",
      scheme: "exact",
      network: "eip155:8453",
      asset: "USDC"
    }
  },
  {
    id: "web-extract",
    name: "Web Extract",
    description: "Turn a public webpage into clean structured text or JSON.",
    tags: ["web", "scrape", "extract", "url", "html", "crawl", "research"],
    priceUsd: 0.02,
    mode: "owned",
    status: "planned"
  },
  {
    id: "js-render",
    name: "JavaScript Render",
    description: "Render a JavaScript-heavy webpage and return machine-readable content.",
    tags: ["javascript", "browser", "render", "web", "url", "scrape"],
    priceUsd: 0.04,
    mode: "owned",
    status: "planned"
  },
  {
    id: "pdf-parse",
    name: "PDF Parse",
    description: "Extract structured text, tables, and metadata from a PDF.",
    tags: ["pdf", "document", "parse", "extract", "table", "ocr"],
    priceUsd: 0.03,
    mode: "owned",
    status: "planned"
  },
  {
    id: "vendor-check",
    name: "Vendor Check",
    description: "Assess a domain or vendor for basic legitimacy and risk signals.",
    tags: ["vendor", "company", "domain", "risk", "trust", "verify"],
    priceUsd: 0.08,
    mode: "owned",
    status: "planned"
  },
  {
    id: "wallet-risk",
    name: "Wallet Risk",
    description: "Analyze an EVM or Tron wallet and return a machine-readable risk verdict.",
    tags: ["wallet", "crypto", "aml", "risk", "ethereum", "tron", "compliance"],
    priceUsd: 0.25,
    mode: "partner",
    status: "planned"
  }
];

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function resolveCapabilities(goal: string, limit = 3) {
  const q = new Set(tokens(goal));

  return CAPABILITIES
    .map((capability) => {
      const haystack = tokens(
        `${capability.name} ${capability.description} ${capability.tags.join(" ")}`
      );
      const overlap = haystack.reduce(
        (score, token) => score + (q.has(token) ? 1 : 0),
        0
      );
      const phraseBonus = capability.tags.some((tag) =>
        goal.toLowerCase().includes(tag)
      )
        ? 3
        : 0;
      const semanticScore = overlap + phraseBonus;
      const liveBonus =
        semanticScore > 0 && capability.status === "live" ? 0.25 : 0;

      return { capability, score: semanticScore + liveBonus };
    })
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.capability.priceUsd - b.capability.priceUsd
    )
    .slice(0, Math.max(1, Math.min(limit, 10)))
    .map(({ capability, score }, index) => ({
      rank: index + 1,
      score,
      ...capability
    }));
}
