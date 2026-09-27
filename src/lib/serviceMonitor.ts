import { createHash } from "node:crypto";
import { auditAgentReadiness, type AgentReadinessReport } from "@/lib/agentReadiness";
import { inspectHttpResource, type HttpInspectReport } from "@/lib/httpInspect";
import { probeMcpEndpoint, type McpProbeReport } from "@/lib/mcpProbe";

export type ServiceMonitorSnapshot = {
  schemaVersion: 1;
  readiness: {
    score: number;
    grade: AgentReadinessReport["grade"];
    checks: Array<{ id: string; ok: boolean; status: number | null; note: string }>;
  };
  mcp: null | {
    reachable: boolean;
    compatible: boolean;
    protocolVersion: string | null;
    serverName: string | null;
    serverVersion: string | null;
    toolCount: number | null;
    toolNames: string[];
    toolContractHash: string | null;
  };
  x402: null | {
    status: number;
    tlsAuthorized: boolean;
    tlsProtocol: string | null;
    detected: boolean;
    parseable: boolean;
    version: number | null;
    scheme: string | null;
    network: string | null;
    asset: string | null;
    payTo: string | null;
    resource: string | null;
    amountAtomic: string | null;
    amountUsd: number | null;
  };
};

export type ServiceMonitorInput = {
  label: string | null;
  origin: string;
  mcpEndpoint: string | null;
  x402Endpoint: string | null;
  baselineFingerprint: string | null;
  baselineSnapshot: ServiceMonitorSnapshot | null;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(input)
      .sort()
      .map((key) => [key, canonicalize(input[key])])
  );
}

function hashJson(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function publicHttps(value: unknown, field: string, max = 500) {
  const raw = text(value, max);
  if (!raw) throw new Error(field + " is required.");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error(field + " must be a public HTTPS URL without credentials or a custom port.");
  }
  url.hash = "";
  return url;
}

function sameOriginOptional(value: unknown, field: string, origin: URL) {
  const raw = text(value, 500);
  if (!raw) return null;
  const url = publicHttps(raw, field);
  if (url.origin !== origin.origin) {
    throw new Error(field + " must share the monitored origin.");
  }
  return url.toString();
}

function parseBaselineSnapshot(value: unknown): ServiceMonitorSnapshot | null {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("baselineSnapshot must be a monitor snapshot object.");
  }
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > 64_000) {
    throw new Error("baselineSnapshot is too large.");
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    throw new Error("baselineSnapshot schemaVersion must be 1.");
  }
  return value as ServiceMonitorSnapshot;
}

export function parseServiceMonitorInput(value: unknown): ServiceMonitorInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Provide a service monitor request.");
  }
  const body = value as Record<string, unknown>;
  const originUrl = publicHttps(body.origin, "origin");
  originUrl.pathname = "/";
  originUrl.search = "";
  originUrl.hash = "";

  const baselineFingerprint = text(body.baselineFingerprint, 64).toLowerCase();
  if (baselineFingerprint && !/^[0-9a-f]{64}$/.test(baselineFingerprint)) {
    throw new Error("baselineFingerprint must be a 64-character SHA-256 hex digest.");
  }

  return {
    label: text(body.label, 120) || null,
    origin: originUrl.toString(),
    mcpEndpoint: sameOriginOptional(body.mcpEndpoint, "mcpEndpoint", originUrl),
    x402Endpoint: sameOriginOptional(body.x402Endpoint, "x402Endpoint", originUrl),
    baselineFingerprint: baselineFingerprint || null,
    baselineSnapshot: parseBaselineSnapshot(body.baselineSnapshot)
  };
}

export function serviceMonitorInputFromQuery(params: URLSearchParams) {
  return parseServiceMonitorInput({
    label: params.get("label"),
    origin: params.get("origin"),
    mcpEndpoint: params.get("mcpEndpoint"),
    x402Endpoint: params.get("x402Endpoint"),
    baselineFingerprint: params.get("baselineFingerprint")
  });
}

export function serviceMonitorId(input: Pick<ServiceMonitorInput, "origin" | "mcpEndpoint" | "x402Endpoint">) {
  const digest = hashJson({
    origin: input.origin,
    mcpEndpoint: input.mcpEndpoint,
    x402Endpoint: input.x402Endpoint
  });
  return "mon_" + digest.slice(0, 20);
}

function toolContractHash(report: McpProbeReport | null) {
  if (!report || report.tools.items.length === 0) return null;
  return hashJson(
    report.tools.items.map((tool) => ({
      name: tool.name,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations
    }))
  );
}

export function buildServiceMonitorSnapshot(
  readiness: AgentReadinessReport,
  mcp: McpProbeReport | null,
  x402: HttpInspectReport | null
): ServiceMonitorSnapshot {
  return {
    schemaVersion: 1,
    readiness: {
      score: readiness.score,
      grade: readiness.grade,
      checks: readiness.checks.map((check) => ({
        id: check.id,
        ok: check.ok,
        status: check.status,
        note: check.note
      }))
    },
    mcp: mcp
      ? {
          reachable: mcp.reachable,
          compatible: mcp.mcpCompatible,
          protocolVersion: mcp.initialize.protocolVersion,
          serverName: mcp.initialize.serverName,
          serverVersion: mcp.initialize.serverVersion,
          toolCount: mcp.tools.count,
          toolNames: [...mcp.tools.names].sort(),
          toolContractHash: toolContractHash(mcp)
        }
      : null,
    x402: x402
      ? {
          status: x402.status,
          tlsAuthorized: x402.tls.authorized,
          tlsProtocol: x402.tls.protocol,
          detected: x402.x402.detected,
          parseable: x402.x402.parseable,
          version: x402.x402.version,
          scheme: x402.x402.scheme,
          network: x402.x402.network,
          asset: x402.x402.asset,
          payTo: x402.x402.payTo,
          resource: x402.x402.resource,
          amountAtomic: x402.x402.amountAtomic,
          amountUsd: x402.x402.amountUsd
        }
      : null
  };
}

export function fingerprintMonitorSnapshot(snapshot: ServiceMonitorSnapshot) {
  return hashJson(snapshot);
}

function flatten(value: unknown, prefix: string, output: Map<string, unknown>) {
  if (Array.isArray(value)) {
    output.set(prefix, value);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix ? prefix + "." + key : key, output);
    }
    return;
  }
  output.set(prefix, value);
}

export function compareMonitorSnapshots(
  before: ServiceMonitorSnapshot,
  after: ServiceMonitorSnapshot
) {
  const left = new Map<string, unknown>();
  const right = new Map<string, unknown>();
  flatten(before, "", left);
  flatten(after, "", right);
  const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
  return paths
    .filter((path) => JSON.stringify(left.get(path)) !== JSON.stringify(right.get(path)))
    .slice(0, 50)
    .map((path) => ({
      path,
      before: left.has(path) ? left.get(path) ?? null : null,
      after: right.has(path) ? right.get(path) ?? null : null
    }));
}

function overallStatus(
  readiness: AgentReadinessReport,
  mcp: McpProbeReport | null,
  x402: HttpInspectReport | null
) {
  const reasons: string[] = [];
  const homepage = readiness.checks.find((check) => check.id === "homepage");
  if (!homepage?.ok) reasons.push("homepage_unreachable");
  if (readiness.score < 60) reasons.push("machine_readiness_below_60");
  if (mcp && !mcp.reachable) reasons.push("mcp_unreachable");
  else if (mcp && !mcp.mcpCompatible) reasons.push("mcp_incompatible");
  if (x402 && (x402.status !== 402 || !x402.x402.parseable)) {
    reasons.push("x402_contract_not_ready");
  }

  const status = !homepage?.ok
    ? "down"
    : reasons.length
      ? "degraded"
      : "healthy";

  return { status, reasons };
}

export async function runServiceMonitor(input: ServiceMonitorInput) {
  const [readiness, mcp, x402] = await Promise.all([
    auditAgentReadiness(input.origin),
    input.mcpEndpoint ? probeMcpEndpoint(input.mcpEndpoint) : Promise.resolve(null),
    input.x402Endpoint
      ? inspectHttpResource(input.x402Endpoint, { method: "GET" })
      : Promise.resolve(null)
  ]);

  const snapshot = buildServiceMonitorSnapshot(readiness, mcp, x402);
  const fingerprint = fingerprintMonitorSnapshot(snapshot);
  const monitorId = serviceMonitorId(input);
  const health = overallStatus(readiness, mcp, x402);

  const baselineSnapshot = input.baselineSnapshot;
  const computedBaselineFingerprint = baselineSnapshot
    ? fingerprintMonitorSnapshot(baselineSnapshot)
    : input.baselineFingerprint;
  const driftDetected = computedBaselineFingerprint
    ? computedBaselineFingerprint !== fingerprint
    : null;
  const changes = baselineSnapshot
    ? compareMonitorSnapshots(baselineSnapshot, snapshot)
    : [];

  return {
    schemaVersion: 1,
    product: "AgentResolver Service Monitor",
    monitorId,
    checkedAt: new Date().toISOString(),
    target: {
      label: input.label,
      origin: input.origin,
      mcpEndpoint: input.mcpEndpoint,
      x402Endpoint: input.x402Endpoint
    },
    health,
    fingerprint,
    snapshot,
    drift: {
      baselineProvided: Boolean(computedBaselineFingerprint),
      detected: driftDetected,
      baselineFingerprint: computedBaselineFingerprint,
      currentFingerprint: fingerprint,
      changes
    },
    details: {
      readiness,
      mcp,
      x402: x402
        ? {
            url: x402.url,
            status: x402.status,
            latencyMs: x402.latencyMs,
            tls: x402.tls,
            x402: x402.x402,
            trust: x402.trust
          }
        : null
    },
    next: {
      managedMonitoring:
        "Use the 30-day managed monitor to run this check hourly and keep a durable public status record without maintaining your own scheduler.",
      managedMonitoringEndpoint:
        "https://agentresolver.vercel.app/api/managed-monitor-30d"
    }
  };
}
