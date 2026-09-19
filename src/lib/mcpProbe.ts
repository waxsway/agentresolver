import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type McpToolEvidence = {
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  annotations: Record<string, unknown> | null;
};

export type McpProbeReport = {
  endpoint: string;
  reachable: boolean;
  mcpCompatible: boolean;
  initialize: {
    status: number | null;
    latencyMs: number | null;
    protocolVersion: string | null;
    serverName: string | null;
    serverVersion: string | null;
    sessionIdPresent: boolean;
  };
  tools: {
    status: number | null;
    latencyMs: number | null;
    count: number | null;
    names: string[];
    items: McpToolEvidence[];
  };
  notes: string[];
};

type HttpResult = {
  status: number | null;
  headers: Headers;
  text: string;
  latencyMs: number | null;
};

const MAX_BYTES = 256_000;
const TIMEOUT_MS = 4_500;
const MAX_REDIRECTS = 2;
const MCP_PROTOCOL_VERSION = "2025-06-18";

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
    throw new Error("Private or local MCP endpoints are not allowed.");
  }

  if (isIP(host) && isBlockedAddress(host)) {
    throw new Error("Private, reserved, or local MCP endpoints are not allowed.");
  }

  return host;
}

export function normalizeMcpEndpoint(input: string): URL {
  const raw = input.trim();
  if (!raw) throw new Error("Provide an MCP endpoint URL.");

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withScheme);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS MCP endpoints are supported.");
  }
  if (url.username || url.password) {
    throw new Error("Credential-bearing MCP URLs are not allowed.");
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
  url.hash = "";
  return url;
}

async function resolvePublicAddress(hostname: string) {
  const host = validateHostname(hostname);
  if (isIP(host)) {
    return { address: host, family: isIP(host) as 4 | 6 };
  }

  const addresses = await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("MCP endpoint did not resolve.");
  if (addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new Error("MCP endpoint resolves to a private or reserved address.");
  }
  return addresses[0];
}

function nodeHeadersToHeaders(values: http.IncomingHttpHeaders): Headers {
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

async function postJson(
  url: URL,
  body: unknown,
  extraHeaders: Record<string, string> = {},
  redirects = 0
): Promise<HttpResult> {
  if (redirects > MAX_REDIRECTS) {
    return { status: null, headers: new Headers(), text: "", latencyMs: null };
  }

  const resolved = await resolvePublicAddress(url.hostname);
  const originalHost = stripIpv6Brackets(url.hostname);
  const payload = JSON.stringify(body);
  const startedAt = Date.now();

  return new Promise<HttpResult>((resolve) => {
    let settled = false;
    const finish = (value: HttpResult) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const responseHandler = (res: http.IncomingMessage) => {
      const status = res.statusCode ?? null;
      const headers = nodeHeadersToHeaders(res.headers);

      if (
        (status === 307 || status === 308) &&
        typeof res.headers.location === "string"
      ) {
        res.resume();
        try {
          const next = new URL(res.headers.location, url);
          if (!["http:", "https:"].includes(next.protocol)) {
            finish({ status, headers, text: "", latencyMs: Date.now() - startedAt });
            return;
          }
          void postJson(next, body, extraHeaders, redirects + 1)
            .then(finish)
            .catch(() =>
              finish({ status: null, headers: new Headers(), text: "", latencyMs: null })
            );
        } catch {
          finish({ status, headers, text: "", latencyMs: Date.now() - startedAt });
        }
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
            status,
            headers,
            text: Buffer.concat(chunks).toString("utf8").slice(0, MAX_BYTES),
            latencyMs: Date.now() - startedAt
          });
          return;
        }
        chunks.push(buffer);
      });

      res.on("end", () => {
        finish({
          status,
          headers,
          text: Buffer.concat(chunks).toString("utf8"),
          latencyMs: Date.now() - startedAt
        });
      });
      res.on("error", () =>
        finish({ status, headers, text: "", latencyMs: Date.now() - startedAt })
      );
    };

    const commonOptions = {
      hostname: resolved.address,
      family: resolved.family,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: `${url.pathname || "/"}${url.search}`,
      method: "POST",
      headers: {
        Host: url.host,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Content-Length": Buffer.byteLength(payload),
        "User-Agent": "AgentResolver-MCP-Probe/0.1",
        Connection: "close",
        ...extraHeaders
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

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () =>
      finish({ status: null, headers: new Headers(), text: "", latencyMs: null })
    );
    req.end(payload);
  });
}

function parseRpcJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:")) {
    const event = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith("data:"));
    if (!event) return null;
    return JSON.parse(event.slice(5).trim());
  }

  return JSON.parse(trimmed);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function probeMcpEndpoint(input: string): Promise<McpProbeReport> {
  const endpoint = normalizeMcpEndpoint(input);
  await resolvePublicAddress(endpoint.hostname);

  const notes: string[] = [];
  const initializeResponse = await postJson(endpoint, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "AgentResolver MCP Probe", version: "0.1.2" }
    }
  });

  const reachable = initializeResponse.status !== null;
  let initializePayload: Record<string, unknown> | null = null;
  try {
    initializePayload = asRecord(parseRpcJson(initializeResponse.text));
  } catch {
    notes.push("Initialize response was not valid JSON or SSE JSON.");
  }

  const initializeResult = asRecord(initializePayload?.result);
  const serverInfo = asRecord(initializeResult?.serverInfo);
  const protocolVersion =
    typeof initializeResult?.protocolVersion === "string"
      ? initializeResult.protocolVersion
      : null;
  const sessionId = initializeResponse.headers.get("mcp-session-id");
  const initialized =
    initializeResponse.status !== null &&
    initializeResponse.status >= 200 &&
    initializeResponse.status < 300 &&
    Boolean(initializeResult);

  if (!reachable) notes.push("Endpoint could not be reached within the probe timeout.");
  if (reachable && !initialized) {
    notes.push("Endpoint responded but did not complete an MCP initialize exchange.");
  }

  let toolsStatus: number | null = null;
  let toolsLatency: number | null = null;
  let toolNames: string[] = [];
  let toolItems: McpToolEvidence[] = [];
  let toolCount: number | null = null;

  if (initialized) {
    const sessionHeaders: Record<string, string> = sessionId
      ? { "Mcp-Session-Id": sessionId }
      : {};

    // Best-effort initialized notification. Some servers reply 202/204; others
    // tolerate tools/list directly after initialize.
    await postJson(
      endpoint,
      { jsonrpc: "2.0", method: "notifications/initialized" },
      sessionHeaders
    );

    const toolsResponse = await postJson(
      endpoint,
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      sessionHeaders
    );
    toolsStatus = toolsResponse.status;
    toolsLatency = toolsResponse.latencyMs;

    try {
      const toolsPayload = asRecord(parseRpcJson(toolsResponse.text));
      const toolsResult = asRecord(toolsPayload?.result);
      const tools = Array.isArray(toolsResult?.tools) ? toolsResult.tools : null;
      if (tools) {
        toolCount = tools.length;
        toolItems = tools
          .map((tool) => asRecord(tool))
          .filter((tool): tool is Record<string, unknown> => Boolean(tool))
          .map((tool) => ({
            name: typeof tool.name === "string" ? tool.name : "",
            description:
              typeof tool.description === "string"
                ? tool.description.slice(0, 2000)
                : null,
            inputSchema: asRecord(tool.inputSchema),
            outputSchema: asRecord(tool.outputSchema),
            annotations: asRecord(tool.annotations)
          }))
          .filter((tool) => Boolean(tool.name))
          .slice(0, 50);
        toolNames = toolItems.map((tool) => tool.name);
      } else {
        notes.push("MCP initialize succeeded, but tools/list did not return a tools array.");
      }
    } catch {
      notes.push("tools/list response was not valid JSON or SSE JSON.");
    }
  }

  const mcpCompatible = initialized && toolCount !== null;
  if (mcpCompatible) {
    notes.push(`MCP handshake succeeded and ${toolCount} tool${toolCount === 1 ? " was" : "s were"} listed.`);
  }

  return {
    endpoint: endpoint.toString(),
    reachable,
    mcpCompatible,
    initialize: {
      status: initializeResponse.status,
      latencyMs: initializeResponse.latencyMs,
      protocolVersion,
      serverName: typeof serverInfo?.name === "string" ? serverInfo.name : null,
      serverVersion:
        typeof serverInfo?.version === "string" ? serverInfo.version : null,
      sessionIdPresent: Boolean(sessionId)
    },
    tools: {
      status: toolsStatus,
      latencyMs: toolsLatency,
      count: toolCount,
      names: toolNames,
      items: toolItems
    },
    notes
  };
}
