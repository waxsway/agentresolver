import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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

type SmallResponse = {
  ok: boolean;
  status: number | null;
  text: string;
  headers: Headers | null;
};

const MAX_BYTES = 128_000;
const TIMEOUT_MS = 3500;
const MAX_REDIRECTS = 3;

function stripIpv6Brackets(hostname: string): string {
  return hostname.replace(/^\[/, "").replace(/\]$/, "");
}

function isBlockedIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [a, b, c] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isBlockedIpv6(address: string): boolean {
  const value = address.toLowerCase().split("%")[0];

  if (value === "::" || value === "::1") return true;

  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    return isIP(mapped) === 4 ? isBlockedIpv4(mapped) : true;
  }

  const first = value.split(":")[0] || "0";
  const firstWord = Number.parseInt(first, 16);

  if (!Number.isFinite(firstWord)) return true;

  return (
    (firstWord & 0xfe00) === 0xfc00 ||
    (firstWord & 0xffc0) === 0xfe80 ||
    (firstWord & 0xff00) === 0xff00 ||
    value.startsWith("2001:db8:")
  );
}

function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return true;
}

function validateHostname(hostname: string): string {
  const host = stripIpv6Brackets(hostname).replace(/\.$/, "").toLowerCase();

  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    throw new Error("Private or local targets are not allowed.");
  }

  return host;
}

async function resolvePublicAddress(hostname: string) {
  const host = validateHostname(hostname);

  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new Error("Private, reserved, or local targets are not allowed.");
    }
    return { address: host, family: isIP(host) as 4 | 6 };
  }

  const addresses = await lookup(host, { all: true, verbatim: true });

  if (addresses.length === 0) {
    throw new Error("Target did not resolve.");
  }

  if (addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new Error("Target resolves to a private or reserved address.");
  }

  return addresses[0];
}

function normalizeTarget(input: string): URL {
  const raw = input.trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withScheme);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http/https targets are supported.");
  }

  if (url.username || url.password) {
    throw new Error("Credential-bearing URLs are not allowed.");
  }

  if (
    url.port &&
    !(
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443")
    )
  ) {
    throw new Error("Only standard HTTP/HTTPS ports are allowed.");
  }

  validateHostname(url.hostname);

  url.pathname = "/";
  url.search = "";
  url.hash = "";

  return url;
}

function headersFromNode(
  values: http.IncomingHttpHeaders
): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  return headers;
}

async function requestPublicUrl(
  url: URL,
  redirects = 0
): Promise<SmallResponse> {
  if (redirects > MAX_REDIRECTS) {
    return { ok: false, status: null, text: "", headers: null };
  }

  if (
    url.port &&
    !(
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443")
    )
  ) {
    return { ok: false, status: null, text: "", headers: null };
  }

  const resolved = await resolvePublicAddress(url.hostname);
  const originalHost = stripIpv6Brackets(url.hostname);
  const path = `${url.pathname || "/"}${url.search}`;

  return new Promise<SmallResponse>((resolve) => {
    let settled = false;

    const finish = (value: SmallResponse) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const responseHandler = (res: http.IncomingMessage) => {
      const status = res.statusCode ?? null;
      const headers = headersFromNode(res.headers);

      if (
        status !== null &&
        status >= 300 &&
        status < 400 &&
        typeof res.headers.location === "string"
      ) {
        res.resume();

        try {
          const next = new URL(res.headers.location, url);
          if (!["http:", "https:"].includes(next.protocol)) {
            finish({ ok: false, status, text: "", headers });
            return;
          }

          void requestPublicUrl(next, redirects + 1)
            .then(finish)
            .catch(() =>
              finish({ ok: false, status: null, text: "", headers: null })
            );
        } catch {
          finish({ ok: false, status, text: "", headers });
        }

        return;
      }

      const declaredLength = Number(res.headers["content-length"] || "0");
      if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
        res.resume();
        finish({
          ok: status !== null && status >= 200 && status < 300,
          status,
          text: "",
          headers
        });
        return;
      }

      const chunks: Buffer[] = [];
      let bytes = 0;

      res.on("data", (chunk: Buffer | string) => {
        if (settled) return;

        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;

        if (bytes > MAX_BYTES) {
          res.destroy();
          finish({
            ok: status !== null && status >= 200 && status < 300,
            status,
            text: Buffer.concat(chunks).toString("utf8").slice(0, MAX_BYTES),
            headers
          });
          return;
        }

        chunks.push(buffer);
      });

      res.on("end", () => {
        finish({
          ok: status !== null && status >= 200 && status < 300,
          status,
          text: Buffer.concat(chunks).toString("utf8"),
          headers
        });
      });

      res.on("error", () => {
        finish({ ok: false, status, text: "", headers });
      });
    };

    const commonOptions = {
      hostname: resolved.address,
      family: resolved.family,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path,
      method: "GET",
      headers: {
        Host: url.host,
        Accept:
          "text/plain, application/json, application/xml, text/html;q=0.8, */*;q=0.5",
        "User-Agent": "AgentResolver-Readiness/0.1",
        Connection: "close"
      },
      timeout: TIMEOUT_MS
    };

    const req =
      url.protocol === "https:"
        ? https.request(
            {
              ...commonOptions,
              servername: isIP(originalHost) ? undefined : originalHost,
              rejectUnauthorized: true
            },
            responseHandler
          )
        : http.request(commonOptions, responseHandler);

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });

    req.on("error", () => {
      finish({ ok: false, status: null, text: "", headers: null });
    });

    req.end();
  });
}

async function fetchSmall(url: URL): Promise<SmallResponse> {
  try {
    return await requestPublicUrl(url);
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

export async function auditAgentReadiness(
  input: string
): Promise<AgentReadinessReport> {
  const base = normalizeTarget(input);

  // Resolve once before launching the parallel checks so invalid/private targets
  // fail without creating any outbound requests.
  await resolvePublicAddress(base.hostname);

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
    checks.reduce(
      (total, check) => total + (check.ok ? weights[check.id] || 0 : 0),
      0
    )
  );

  const issues = checks
    .filter((check) => !check.ok)
    .map((check) => `${check.id}: ${check.note}`);

  const recommendations: string[] = [];

  if (!results.find((item) => item.id === "llms")?.ok) {
    recommendations.push(
      "Publish /llms.txt with concise machine-readable service instructions."
    );
  }
  if (!results.find((item) => item.id === "ard")?.ok) {
    recommendations.push(
      "Publish /.well-known/ard.json and advertise it from robots.txt."
    );
  }
  if (!results.find((item) => item.id === "openapi")?.ok) {
    recommendations.push(
      "Publish /openapi.json for callable HTTP capabilities."
    );
  }
  if (!results.find((item) => item.id === "sitemap")?.ok) {
    recommendations.push(
      "Publish /sitemap.xml so discovery surfaces are crawlable."
    );
  }
  if (!results.find((item) => item.id === "mcp-card")?.ok) {
    recommendations.push(
      "If you expose MCP, publish machine-readable server metadata."
    );
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
