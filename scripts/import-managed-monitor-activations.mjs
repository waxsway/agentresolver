import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const EVENT_NAME = "managed_monitor_activation_requested";
const CAPABILITY_ID = "managed-monitor-30d";
const SOURCE = "managed-monitor-30d";
const MAX_DEPTH = 8;
const MAX_STRING_LENGTH = 1_000_000;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function parseJsonObject(value) {
  if (typeof value !== "string") return asObject(value);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_STRING_LENGTH) return null;

  const candidates = [trimmed];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      return asObject(JSON.parse(candidate));
    } catch {
      // Vercel can wrap structured console output in a JSON/log envelope.
    }
  }
  return null;
}

function collectEvents(value, events, seenObjects, depth = 0) {
  if (depth > MAX_DEPTH || value === null || value === undefined) return;

  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) return;

    const parsedWhole = parseJsonObject(value);
    if (parsedWhole) {
      collectEvents(parsedWhole, events, seenObjects, depth + 1);
      return;
    }

    for (const line of value.split(/\r?\n/)) {
      const parsedLine = parseJsonObject(line);
      if (parsedLine) collectEvents(parsedLine, events, seenObjects, depth + 1);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectEvents(item, events, seenObjects, depth + 1);
    return;
  }

  if (typeof value !== "object") return;
  if (seenObjects.has(value)) return;
  seenObjects.add(value);

  if (value.event === EVENT_NAME) events.push(value);
  for (const nested of Object.values(value)) {
    collectEvents(nested, events, seenObjects, depth + 1);
  }
}

export function extractManagedMonitorActivationEventsFromText(text) {
  const raw = String(text || "");
  if (!raw.trim()) return [];

  const events = [];
  const seenObjects = new WeakSet();
  for (const record of raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
    const parsed = parseJsonObject(record);
    if (parsed) collectEvents(parsed, events, seenObjects);
  }

  const deduped = new Map();
  for (const event of events) {
    const key =
      typeof event.activationId === "string" && event.activationId
        ? event.activationId
        : JSON.stringify(event);
    if (!deduped.has(key)) deduped.set(key, event);
  }
  return [...deduped.values()];
}

function normalizeOptionalSameOriginUrl(value, origin) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== origin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeManagedMonitorActivation(event) {
  const value = asObject(event);
  if (!value) return null;
  if (value.event !== EVENT_NAME || value.capabilityId !== CAPABILITY_ID) return null;
  if (value.source !== SOURCE || value.billable !== true) return null;
  if (typeof value.id !== "string" || !/^mon_[0-9a-f]{20}$/.test(value.id)) return null;
  if (
    typeof value.activationId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.activationId)
  ) {
    return null;
  }

  let origin;
  try {
    const url = new URL(value.origin);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    origin = url.toString();
  } catch {
    return null;
  }

  const activatedAtMs = Date.parse(value.activatedAt);
  const activeUntilMs = Date.parse(value.activeUntil);
  if (
    !Number.isFinite(activatedAtMs) ||
    !Number.isFinite(activeUntilMs) ||
    activeUntilMs <= activatedAtMs
  ) {
    return null;
  }

  const originUrl = new URL(origin);
  const mcpEndpoint = normalizeOptionalSameOriginUrl(value.mcpEndpoint, originUrl.origin);
  const x402Endpoint = normalizeOptionalSameOriginUrl(value.x402Endpoint, originUrl.origin);
  if (value.mcpEndpoint && !mcpEndpoint) return null;
  if (value.x402Endpoint && !x402Endpoint) return null;

  return {
    id: value.id,
    label: typeof value.label === "string" && value.label.trim() ? value.label.trim().slice(0, 120) : null,
    origin,
    mcpEndpoint,
    x402Endpoint,
    activatedAt: new Date(activatedAtMs).toISOString(),
    activeUntil: new Date(activeUntilMs).toISOString(),
    billable: true,
    source: SOURCE,
    activationId: value.activationId
  };
}

export function mergeManagedMonitorActivations(registry, rawEvents) {
  const current = asObject(registry);
  if (current?.schemaVersion !== 1 || !Array.isArray(current.services)) {
    throw new Error("Managed monitor registry must use schemaVersion 1 and a services array.");
  }

  const services = current.services
    .map((service) => asObject(service))
    .filter(Boolean)
    .map((service) => ({ ...service }));

  const seenActivationIds = new Set(
    services
      .map((service) => service.activationId)
      .filter((id) => typeof id === "string" && id)
  );

  let imported = 0;
  let renewed = 0;
  let ignored = 0;

  const normalized = rawEvents
    .map(normalizeManagedMonitorActivation)
    .filter((event) => {
      if (!event) {
        ignored += 1;
        return false;
      }
      return true;
    })
    .sort((a, b) => Date.parse(a.activatedAt) - Date.parse(b.activatedAt));

  for (const event of normalized) {
    if (seenActivationIds.has(event.activationId)) {
      ignored += 1;
      continue;
    }

    const existingIndex = services.findIndex((service) => service.id === event.id);
    if (existingIndex < 0) {
      services.push(event);
      imported += 1;
      seenActivationIds.add(event.activationId);
      continue;
    }

    const existing = services[existingIndex];
    const existingUntil = Date.parse(existing.activeUntil || "");
    const eventUntil = Date.parse(event.activeUntil);
    const existingActivated = Date.parse(existing.activatedAt || "");
    const eventActivated = Date.parse(event.activatedAt);

    services[existingIndex] = {
      ...existing,
      ...event,
      activatedAt:
        Number.isFinite(existingActivated) && existingActivated < eventActivated
          ? new Date(existingActivated).toISOString()
          : event.activatedAt,
      activeUntil:
        Number.isFinite(existingUntil) && existingUntil > eventUntil
          ? new Date(existingUntil).toISOString()
          : event.activeUntil
    };
    renewed += 1;
    seenActivationIds.add(event.activationId);
  }

  services.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return {
    registry: { schemaVersion: 1, services },
    stats: { imported, renewed, ignored }
  };
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function selfTest() {
  const activation = {
    event: EVENT_NAME,
    capabilityId: CAPABILITY_ID,
    id: "mon_0123456789abcdefabcd",
    label: "Example",
    origin: "https://api.example.com/",
    mcpEndpoint: "https://api.example.com/mcp",
    x402Endpoint: null,
    activatedAt: "2026-10-01T16:00:00.000Z",
    activeUntil: "2026-10-31T16:00:00.000Z",
    billable: true,
    source: SOURCE,
    activationId: "123e4567-e89b-42d3-a456-426614174000"
  };

  const wrapped = JSON.stringify({ message: JSON.stringify(activation) });
  const extracted = extractManagedMonitorActivationEventsFromText(wrapped + "\n" + wrapped);
  assert.equal(extracted.length, 1);

  const first = mergeManagedMonitorActivations({ schemaVersion: 1, services: [] }, extracted);
  assert.equal(first.stats.imported, 1);
  assert.equal(first.registry.services[0].id, activation.id);

  const duplicate = mergeManagedMonitorActivations(first.registry, extracted);
  assert.equal(duplicate.stats.imported, 0);
  assert.equal(duplicate.stats.renewed, 0);
  assert.equal(duplicate.registry.services.length, 1);

  assert.equal(
    normalizeManagedMonitorActivation({ ...activation, billable: false }),
    null
  );
  assert.equal(
    normalizeManagedMonitorActivation({
      ...activation,
      mcpEndpoint: "https://evil.example/mcp"
    }),
    null
  );

  process.stdout.write(JSON.stringify({ selfTest: "ok" }) + "\n");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const registryPath = arg("--registry");
  const logsPath = arg("--logs");
  if (!registryPath || !logsPath) {
    throw new Error(
      "Usage: node scripts/import-managed-monitor-activations.mjs --registry <registry.json> --logs <vercel-logs.jsonl>"
    );
  }

  const registry = JSON.parse(readFileSync(registryPath, "utf8"));
  const rawLogs = readFileSync(logsPath, "utf8");
  const events = extractManagedMonitorActivationEventsFromText(rawLogs);
  const merged = mergeManagedMonitorActivations(registry, events);

  writeFileSync(registryPath, JSON.stringify(merged.registry, null, 2) + "\n");
  process.stdout.write(
    JSON.stringify({
      activationEvents: events.length,
      ...merged.stats,
      serviceCount: merged.registry.services.length
    }) + "\n"
  );
}

if (process.argv[1] && process.argv[1].endsWith("import-managed-monitor-activations.mjs")) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
