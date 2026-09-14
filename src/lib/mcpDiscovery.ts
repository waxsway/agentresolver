export type McpDirectoryMatch = {
  source: "official-mcp-registry" | "mcpub";
  name: string | null;
  title: string | null;
  description: string | null;
  version: string | null;
  endpoint: string | null;
  transport: string | null;
  repository: string | null;
  website: string | null;
  verifiedLive: boolean | null;
};

type CacheEntry = {
  expiresAt: number;
  value: McpDirectoryMatch[];
};

const cache = new Map<string, CacheEntry>();
const CACHE_MS = 5 * 60 * 1000;

const SAFE_CAPABILITY_TERMS: Array<[RegExp, string]> = [
  [/\bgithub\b|\brepositor(?:y|ies)\b|\bsource control\b/i, "github"],
  [/\bpostgres(?:ql)?\b/i, "postgres"],
  [/\bmysql\b/i, "mysql"],
  [/\bredis\b/i, "redis"],
  [/\bdatabase\b|\bsql\b/i, "database"],
  [/\bbrowser\b|\bselenium\b|\bplaywright\b|\bweb automation\b/i, "browser"],
  [/\bscrap(?:e|ing)\b|\bcrawl(?:er|ing)?\b/i, "web"],
  [/\bfilesystem\b|\bfile system\b/i, "filesystem"],
  [/\bpdf\b/i, "pdf"],
  [/\bslack\b/i, "slack"],
  [/\bemail\b|\bgmail\b/i, "email"],
  [/\bcalendar\b/i, "calendar"],
  [/\bnotion\b/i, "notion"],
  [/\blinear\b/i, "linear"],
  [/\bjira\b/i, "jira"],
  [/\bstripe\b/i, "stripe"],
  [/\bshopify\b/i, "shopify"],
  [/\bsalesforce\b/i, "salesforce"],
  [/\bhubspot\b/i, "hubspot"],
  [/\baws\b|\bamazon web services\b/i, "aws"],
  [/\bcloudflare\b/i, "cloudflare"],
  [/\bdocker\b/i, "docker"],
  [/\bkubernetes\b|\bk8s\b/i, "kubernetes"],
  [/\bterminal\b|\bshell\b|\bcommand line\b/i, "terminal"],
  [/\bmemory\b/i, "memory"],
  [/\bvector\b|\bembedding(?:s)?\b/i, "vector"],
  [/\banalytics\b/i, "analytics"],
  [/\bcrm\b/i, "crm"],
  [/\bsearch\b|\bresearch\b/i, "search"]
];

function safeCapabilityTerm(goal: string): string | null {
  for (const [pattern, term] of SAFE_CAPABILITY_TERMS) {
    if (pattern.test(goal)) return term;
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function transportName(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "type" in value) {
    return stringOrNull((value as { type?: unknown }).type);
  }
  return null;
}

function dedupe(items: McpDirectoryMatch[], limit: number): McpDirectoryMatch[] {
  const seen = new Set<string>();
  const output: McpDirectoryMatch[] = [];

  for (const item of items) {
    const key = (
      item.endpoint ||
      item.name ||
      item.repository ||
      `${item.source}:${item.title || item.description || ""}`
    ).toLowerCase();

    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
    if (output.length >= limit) break;
  }

  return output;
}

function officialMatch(raw: unknown): McpDirectoryMatch | null {
  if (!raw || typeof raw !== "object") return null;

  const entry = raw as Record<string, unknown>;
  const serverRaw =
    entry.server && typeof entry.server === "object"
      ? (entry.server as Record<string, unknown>)
      : entry;

  const remotes = Array.isArray(serverRaw.remotes)
    ? (serverRaw.remotes as Array<Record<string, unknown>>)
    : [];

  const repositoryRaw =
    serverRaw.repository && typeof serverRaw.repository === "object"
      ? (serverRaw.repository as Record<string, unknown>)
      : null;

  return {
    source: "official-mcp-registry",
    name: stringOrNull(serverRaw.name),
    title: stringOrNull(serverRaw.title),
    description: stringOrNull(serverRaw.description),
    version: stringOrNull(serverRaw.version),
    endpoint: stringOrNull(remotes[0]?.url),
    transport: transportName(remotes[0]?.type),
    repository: stringOrNull(repositoryRaw?.url),
    website: stringOrNull(serverRaw.websiteUrl),
    verifiedLive: null
  };
}

function listFromUnknown(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const object = value as Record<string, unknown>;
  for (const key of ["servers", "results", "items", "data", "matches", "endpoints"]) {
    if (Array.isArray(object[key])) return object[key] as unknown[];
  }

  return [];
}

function mcpubMatch(raw: unknown): McpDirectoryMatch | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;

  const endpoint =
    stringOrNull(item.url) ||
    stringOrNull(item.endpoint) ||
    stringOrNull(item.mcpUrl) ||
    stringOrNull(item.mcp_url);

  const repository =
    stringOrNull(item.repository) ||
    stringOrNull(item.repo) ||
    stringOrNull(item.github);

  const name =
    stringOrNull(item.name) ||
    stringOrNull(item.title) ||
    (endpoint ? new URL(endpoint).hostname : null);

  if (!endpoint && !name) return null;

  return {
    source: "mcpub",
    name,
    title: stringOrNull(item.title),
    description: stringOrNull(item.description),
    version: stringOrNull(item.version),
    endpoint,
    transport:
      stringOrNull(item.transport) ||
      stringOrNull(item.type) ||
      (endpoint ? "streamable-http" : null),
    repository,
    website:
      stringOrNull(item.website) ||
      stringOrNull(item.homepage) ||
      null,
    verifiedLive:
      typeof item.live === "boolean"
        ? item.live
        : typeof item.verified === "boolean"
          ? item.verified
          : true
  };
}

async function queryOfficialRegistry(
  term: string,
  limit: number
): Promise<McpDirectoryMatch[]> {
  const endpoint = new URL(
    "https://registry.modelcontextprotocol.io/v0.1/servers"
  );
  endpoint.searchParams.set("search", term);
  endpoint.searchParams.set("version", "latest");
  endpoint.searchParams.set("limit", String(Math.min(limit, 5)));

  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent": "AgentResolver/0.1"
      },
      signal: AbortSignal.timeout(1600),
      next: { revalidate: 300 }
    });

    if (!response.ok) return [];

    const body = (await response.json()) as unknown;
    return listFromUnknown(body)
      .map(officialMatch)
      .filter((item): item is McpDirectoryMatch => Boolean(item));
  } catch {
    return [];
  }
}

async function queryMcpub(
  term: string,
  limit: number
): Promise<McpDirectoryMatch[]> {
  try {
    const response = await fetch("https://mcpub.dev/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "AgentResolver/0.1"
      },
      signal: AbortSignal.timeout(1800),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "search_live",
          arguments: {
            query: term,
            limit: Math.min(limit, 5)
          }
        }
      })
    });

    if (!response.ok) return [];

    const envelope = (await response.json()) as Record<string, unknown>;
    const result =
      envelope.result && typeof envelope.result === "object"
        ? (envelope.result as Record<string, unknown>)
        : null;

    const content = Array.isArray(result?.content)
      ? (result?.content as Array<Record<string, unknown>>)
      : [];

    for (const block of content) {
      const text = stringOrNull(block.text);
      if (!text) continue;

      try {
        const parsed = JSON.parse(text) as unknown;
        const matches = listFromUnknown(parsed)
          .map(mcpubMatch)
          .filter((item): item is McpDirectoryMatch => Boolean(item));
        if (matches.length > 0) return matches;
      } catch {
        // Ignore non-JSON tool text.
      }
    }

    return [];
  } catch {
    return [];
  }
}

export async function discoverMcpServers(
  goal: string,
  limit = 3
): Promise<McpDirectoryMatch[]> {
  const safeLimit = Math.max(1, Math.min(limit, 10));
  const term = safeCapabilityTerm(goal);

  // Privacy: never forward arbitrary user text to a third-party directory.
  if (!term) return [];

  const cached = cache.get(term);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value.slice(0, safeLimit);
  }

  const [official, mcpub] = await Promise.all([
    queryOfficialRegistry(term, safeLimit),
    queryMcpub(term, safeLimit)
  ]);

  const combined = dedupe([...mcpub, ...official], safeLimit);
  cache.set(term, {
    expiresAt: Date.now() + CACHE_MS,
    value: combined
  });

  return combined;
}
