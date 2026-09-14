export type ReadinessCheck = {
  id: string;
  ok: boolean;
  status: number | null;
  url: string;
  note: string;
};

export type AgentReadinessReport = {
  target: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  checks: ReadinessCheck[];
  issues: string[];
  recommendations: string[];
};

const MAX_BYTES = 256_000;
const TIMEOUT_MS = 3500;

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

function normalizeTarget(input: string): URL {
  const raw = input.trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withScheme);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http/https targets are supported.");
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error("Private or local targets are not allowed.");
  }

  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

async function fetchSmall(url: URL): Promise<{
  ok: boolean;
  status: number | null;
  text: string;
  headers: Headers | null;
}> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: "text/plain, application/json, application/xml, text/html;q=0.8, */*;q=0.5",
        "user-agent": "AgentResolver-Readiness/0.1"
      },
      cache: "no-store"
    });

    const length = Number(response.headers.get("content-length") || "0");
    if (Number.isFinite(length) && length > MAX_BYTES) {
      return {
        ok: response.ok,
        status: response.status,
        text: "",
        headers: response.headers
      };
    }

    const text = (await response.text()).slice(0, MAX_BYTES);
    return {
      ok: response.ok,
      status: response.status,
      text,
      headers: response.headers
    };
  } catch {
    return { ok: false, status: null, text: "", headers: null };
  }
}

function gradeFor(score: number): AgentReadinessReport["grade"] {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export async function auditAgentReadiness(input: string): Promise<AgentReadinessReport> {
  const base = normalizeTarget(input);

  const targets = [
    ["robots", "/robots.txt"],
    ["llms", "/llms.txt"],
    ["llms-full", "/llms-full.txt"],
    ["ard", "/.well-known/ard.json"],
    ["openapi", "/openapi.json"],
    ["sitemap", "/sitemap.xml"],
    ["mcp-card", "/mcp/server-card"]
  ] as const;

  const results = await Promise.all(
    targets.map(async ([id, path]) => {
      const url = new URL(path, base);
      const result = await fetchSmall(url);

      let note = result.ok ? "Found." : "Not found or unreachable.";

      if (id === "robots" && result.ok) {
        note = /agentmap:/i.test(result.text)
          ? "robots.txt found and advertises Agentmap."
          : "robots.txt found but no Agentmap directive detected.";
      } else if (id === "llms" && result.ok) {
        note = "llms.txt found.";
      } else if (id === "ard" && result.ok) {
        try {
          const parsed = JSON.parse(result.text);
          note = Array.isArray(parsed?.entries)
            ? `ARD manifest found with ${parsed.entries.length} entr${parsed.entries.length === 1 ? "y" : "ies"}.`
            : "ARD manifest found but entries were not detected.";
        } catch {
          note = "ARD path responded but did not contain valid JSON.";
        }
      } else if (id === "openapi" && result.ok) {
        try {
          const parsed = JSON.parse(result.text);
          note = parsed?.openapi
            ? `OpenAPI ${String(parsed.openapi)} found.`
            : "OpenAPI path responded but no version field was detected.";
        } catch {
          note = "OpenAPI path responded but did not contain valid JSON.";
        }
      }

      return {
        id,
        ok: result.ok,
        status: result.status,
        url: url.toString(),
        note
      } satisfies ReadinessCheck;
    })
  );

  const homepage = await fetchSmall(base);
  const homepageCheck: ReadinessCheck = {
    id: "homepage",
    ok: homepage.ok,
    status: homepage.status,
    url: base.toString(),
    note: homepage.ok ? "Homepage reachable." : "Homepage unreachable."
  };

  const securitySignals = [
    "strict-transport-security",
    "content-security-policy",
    "x-content-type-options",
    "referrer-policy"
  ];
  const presentSecurityHeaders = securitySignals.filter((key) =>
    homepage.headers?.has(key)
  );

  const headerCheck: ReadinessCheck = {
    id: "security-headers",
    ok: presentSecurityHeaders.length >= 2,
    status: homepage.status,
    url: base.toString(),
    note: `${presentSecurityHeaders.length}/${securitySignals.length} baseline security headers detected.`
  };

  const checks = [homepageCheck, ...results, headerCheck];

  const weights: Record<string, number> = {
    homepage: 10,
    robots: 10,
    llms: 15,
    "llms-full": 5,
    ard: 20,
    openapi: 15,
    sitemap: 10,
    "mcp-card": 10,
    "security-headers": 5
  };

  const score = Math.round(
    checks.reduce((total, check) => total + (check.ok ? weights[check.id] || 0 : 0), 0)
  );

  const issues = checks
    .filter((check) => !check.ok)
    .map((check) => `${check.id}: ${check.note}`);

  const recommendations: string[] = [];
  if (!results.find((item) => item.id === "llms")?.ok) {
    recommendations.push("Publish /llms.txt with concise machine-readable service instructions.");
  }
  if (!results.find((item) => item.id === "ard")?.ok) {
    recommendations.push("Publish /.well-known/ard.json and advertise it from robots.txt.");
  }
  if (!results.find((item) => item.id === "openapi")?.ok) {
    recommendations.push("Publish /openapi.json for callable HTTP capabilities.");
  }
  if (!results.find((item) => item.id === "sitemap")?.ok) {
    recommendations.push("Publish /sitemap.xml so discovery surfaces are crawlable.");
  }
  if (!results.find((item) => item.id === "mcp-card")?.ok) {
    recommendations.push("If you expose MCP, publish machine-readable server metadata.");
  }

  return {
    target: base.toString(),
    score,
    grade: gradeFor(score),
    checks,
    issues,
    recommendations
  };
}
