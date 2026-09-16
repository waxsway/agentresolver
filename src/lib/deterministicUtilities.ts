import { createHash, randomUUID } from "node:crypto";

const MAX_JSON_BYTES = 128 * 1024;

export function stableJson(value: unknown): string {
  function sort(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === "object") {
      const record = input as Record<string, unknown>;
      return Object.fromEntries(Object.keys(record).sort().map((key) => [key, sort(record[key])]));
    }
    return input;
  }
  const json = JSON.stringify(sort(value)) ?? "null";
  if (Buffer.byteLength(json, "utf8") > MAX_JSON_BYTES) throw new Error("JSON value exceeds 131072 bytes.");
  return json;
}

export function normalizeJson(value: unknown) {
  const normalized = stableJson(value);
  return {
    normalized,
    sha256: createHash("sha256").update(normalized, "utf8").digest("hex"),
    bytes: Buffer.byteLength(normalized, "utf8")
  };
}

type Schema = Record<string, unknown>;
type ValidationError = { path: string; keyword: string; message: string };

function typeMatches(value: unknown, type: string) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return !!value && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

export function validateJsonSchema(data: unknown, schema: Schema) {
  const errors: ValidationError[] = [];
  let checks = 0;

  function walk(value: unknown, rule: Schema, path: string, depth: number) {
    if (depth > 20) {
      errors.push({ path, keyword: "depth", message: "Schema nesting exceeds 20 levels." });
      return;
    }
    checks += 1;
    if (checks > 5000) {
      errors.push({ path, keyword: "complexity", message: "Validation exceeded 5000 checks." });
      return;
    }

    if (Array.isArray(rule.enum) && !rule.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) {
      errors.push({ path, keyword: "enum", message: "Value is not in enum." });
    }

    const declaredType = typeof rule.type === "string" ? rule.type : null;
    if (declaredType && !typeMatches(value, declaredType)) {
      errors.push({ path, keyword: "type", message: `Expected ${declaredType}.` });
      return;
    }

    if (typeof value === "string") {
      if (typeof rule.minLength === "number" && value.length < rule.minLength) errors.push({ path, keyword: "minLength", message: `Minimum length is ${rule.minLength}.` });
      if (typeof rule.maxLength === "number" && value.length > rule.maxLength) errors.push({ path, keyword: "maxLength", message: `Maximum length is ${rule.maxLength}.` });
      if (typeof rule.pattern === "string") {
        try {
          if (!new RegExp(rule.pattern).test(value)) errors.push({ path, keyword: "pattern", message: "String does not match pattern." });
        } catch {
          errors.push({ path, keyword: "pattern", message: "Schema pattern is invalid." });
        }
      }
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      if (typeof rule.minimum === "number" && value < rule.minimum) errors.push({ path, keyword: "minimum", message: `Minimum is ${rule.minimum}.` });
      if (typeof rule.maximum === "number" && value > rule.maximum) errors.push({ path, keyword: "maximum", message: `Maximum is ${rule.maximum}.` });
    }

    if (Array.isArray(value)) {
      if (typeof rule.minItems === "number" && value.length < rule.minItems) errors.push({ path, keyword: "minItems", message: `Minimum items is ${rule.minItems}.` });
      if (typeof rule.maxItems === "number" && value.length > rule.maxItems) errors.push({ path, keyword: "maxItems", message: `Maximum items is ${rule.maxItems}.` });
      if (rule.items && typeof rule.items === "object" && !Array.isArray(rule.items)) {
        value.forEach((item, index) => walk(item, rule.items as Schema, `${path}[${index}]`, depth + 1));
      }
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      const properties = rule.properties && typeof rule.properties === "object" && !Array.isArray(rule.properties)
        ? rule.properties as Record<string, Schema>
        : {};
      const required = Array.isArray(rule.required) ? rule.required.filter((item): item is string => typeof item === "string") : [];
      for (const key of required) {
        if (!(key in record)) errors.push({ path: `${path}.${key}`, keyword: "required", message: "Required property is missing." });
      }
      for (const [key, childRule] of Object.entries(properties)) {
        if (key in record && childRule && typeof childRule === "object") walk(record[key], childRule, `${path}.${key}`, depth + 1);
      }
      if (rule.additionalProperties === false) {
        for (const key of Object.keys(record)) {
          if (!(key in properties)) errors.push({ path: `${path}.${key}`, keyword: "additionalProperties", message: "Additional property is not allowed." });
        }
      }
    }
  }

  stableJson(data);
  stableJson(schema);
  walk(data, schema, "$", 0);
  return { valid: errors.length === 0, errorCount: errors.length, errors };
}

export function parseUrl(input: string) {
  if (input.length > 4096) throw new Error("url exceeds 4096 characters.");
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("url must be an absolute valid URL."); }
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  return {
    href: url.href,
    origin: url.origin,
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || null,
    pathname: url.pathname,
    query,
    fragment: url.hash ? url.hash.slice(1) : null
  };
}

export function generateUuidV4(count = 1) {
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error("count must be an integer from 1 to 20.");
  return { count, values: Array.from({ length: count }, () => randomUUID()) };
}

export function slugify(text: string, separator: "-" | "_" = "-") {
  if (Buffer.byteLength(text, "utf8") > 8192) throw new Error("text exceeds 8192 bytes.");
  const slug = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "");
  return { slug, separator, changed: slug !== text };
}
