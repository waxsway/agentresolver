import { readFileSync, writeFileSync } from "node:fs";

const EVENT_NAME = "paid_capability_settled";
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
      // Vercel can wrap structured logs in text. Individual lines are tried below.
    }
  }
  return null;
}

function collectSettlementEvents(value, events, seenObjects, depth = 0) {
  if (depth > MAX_DEPTH || value === null || value === undefined) return;

  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) return;

    const parsedWhole = parseJsonObject(value);
    if (parsedWhole) {
      collectSettlementEvents(parsedWhole, events, seenObjects, depth + 1);
      return;
    }

    for (const line of value.split(/\r?\n/)) {
      const parsedLine = parseJsonObject(line);
      if (parsedLine) collectSettlementEvents(parsedLine, events, seenObjects, depth + 1);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectSettlementEvents(item, events, seenObjects, depth + 1);
    return;
  }

  if (typeof value !== "object") return;
  if (seenObjects.has(value)) return;
  seenObjects.add(value);

  if (value.event === EVENT_NAME) events.push(value);

  for (const nested of Object.values(value)) {
    collectSettlementEvents(nested, events, seenObjects, depth + 1);
  }
}

export function extractSettlementEventsFromText(text) {
  const raw = String(text || "");
  if (!raw.trim()) return [];

  const events = [];
  const seenObjects = new WeakSet();
  const records = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (const record of records) {
    const parsed = parseJsonObject(record);
    if (parsed) collectSettlementEvents(parsed, events, seenObjects);
  }

  const deduped = new Map();
  for (const event of events) {
    const key = JSON.stringify(event);
    if (!deduped.has(key)) deduped.set(key, event);
  }
  return [...deduped.values()];
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
  const inputPath = arg("--input");
  const outputPath = arg("--output");
  if (!inputPath || !outputPath) {
    throw new Error(
      "Usage: node scripts/extract-settlement-log-events.mjs --input <file> --output <file>"
    );
  }

  const events = extractSettlementEventsFromText(readFileSync(inputPath, "utf8"));
  const output = events.map((event) => JSON.stringify(event)).join("\n");
  writeFileSync(outputPath, output ? `${output}\n` : "");
  process.stdout.write(JSON.stringify({ settlementEventCount: events.length }) + "\n");
}

if (process.argv[1] && process.argv[1].endsWith("extract-settlement-log-events.mjs")) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
