import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const registryPath = process.argv[2];
const statusDir = process.argv[3];

if (!registryPath || !statusDir) {
  throw new Error("Usage: node scripts/run-managed-monitors.mjs <registry.json> <status-dir>");
}

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
if (registry?.schemaVersion !== 1 || !Array.isArray(registry.services)) {
  throw new Error("Managed monitor registry must use schemaVersion 1 and a services array.");
}

mkdirSync(statusDir, { recursive: true });
const now = new Date();
const summaries = [];

function safeId(value) {
  return typeof value === "string" && /^mon_[0-9a-f]{20}$/.test(value) ? value : null;
}

function loadPrevious(id) {
  const path = join(statusDir, id + ".json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

for (const service of registry.services.slice(0, 50)) {
  const id = safeId(service?.id);
  if (!id) {
    console.error("Skipping invalid monitor id.");
    continue;
  }

  const outputPath = join(statusDir, id + ".json");
  const previous = loadPrevious(id);
  const activeUntil = typeof service.activeUntil === "string" ? Date.parse(service.activeUntil) : Number.NaN;

  if (Number.isFinite(activeUntil) && activeUntil <= now.getTime()) {
    const expired = {
      schemaVersion: 1,
      id,
      state: "expired",
      label: service.label ?? null,
      activeUntil: service.activeUntil,
      lastCheckedAt: previous?.lastCheckedAt ?? null,
      monitor: previous?.monitor ?? null
    };
    writeFileSync(outputPath, JSON.stringify(expired, null, 2) + "\n");
    summaries.push({
      id,
      label: service.label ?? null,
      state: "expired",
      health: previous?.monitor?.health?.status ?? null,
      lastCheckedAt: previous?.lastCheckedAt ?? null,
      activeUntil: service.activeUntil
    });
    continue;
  }

  const payload = {
    label: service.label ?? null,
    origin: service.origin,
    mcpEndpoint: service.mcpEndpoint ?? null,
    x402Endpoint: service.x402Endpoint ?? null,
    baselineSnapshot: previous?.monitor?.snapshot ?? null
  };

  try {
    const response = await fetch("https://agentresolver.vercel.app/api/service-monitor", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "AgentResolver-Managed-Monitor/0.1"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000)
    });
    if (!response.ok) {
      throw new Error("service monitor returned HTTP " + response.status);
    }
    const monitor = await response.json();
    if (monitor?.monitorId !== id) {
      throw new Error("managed monitor id does not match registry entry");
    }

    const record = {
      schemaVersion: 1,
      id,
      state: "active",
      label: service.label ?? null,
      activatedAt: service.activatedAt ?? null,
      activeUntil: service.activeUntil ?? null,
      billable: service.billable === true,
      source: service.source ?? "managed-monitor",
      activationId: service.activationId ?? null,
      lastCheckedAt: monitor.checkedAt,
      monitor
    };
    writeFileSync(outputPath, JSON.stringify(record, null, 2) + "\n");
    summaries.push({
      id,
      label: service.label ?? null,
      state: "active",
      health: monitor.health?.status ?? null,
      driftDetected: monitor.drift?.detected ?? null,
      lastCheckedAt: monitor.checkedAt,
      activeUntil: service.activeUntil ?? null
    });
    console.log(JSON.stringify({
      event: "managed_monitor_check",
      id,
      state: "active",
      health: monitor.health?.status ?? null,
      driftDetected: monitor.drift?.detected ?? null
    }));
  } catch (error) {
    const failedAt = new Date().toISOString();
    const record = {
      schemaVersion: 1,
      id,
      state: "check_failed",
      label: service.label ?? null,
      activatedAt: service.activatedAt ?? null,
      activeUntil: service.activeUntil ?? null,
      billable: service.billable === true,
      source: service.source ?? "managed-monitor",
      activationId: service.activationId ?? null,
      lastCheckedAt: failedAt,
      error: error instanceof Error ? error.message : "Managed monitor check failed.",
      monitor: previous?.monitor ?? null
    };
    writeFileSync(outputPath, JSON.stringify(record, null, 2) + "\n");
    summaries.push({
      id,
      label: service.label ?? null,
      state: "check_failed",
      health: previous?.monitor?.health?.status ?? null,
      lastCheckedAt: failedAt,
      activeUntil: service.activeUntil ?? null
    });
    console.error(JSON.stringify({
      event: "managed_monitor_check_failed",
      id,
      at: failedAt,
      message: record.error
    }));
  }
}

const indexPath = join(statusDir, "index.json");
mkdirSync(dirname(indexPath), { recursive: true });
writeFileSync(indexPath, JSON.stringify({
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  services: summaries
}, null, 2) + "\n");
