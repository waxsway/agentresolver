import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_SPEC_BYTES = 512_000;
const TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 2;
const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

type JsonObject = Record<string, unknown>;

export type OpenApiOperationChoice = {
  operationId: string | null;
  method: string;
  path: string;
  summary: string | null;
  description: string | null;
  tags: string[];
  deprecated: boolean;
  score: number;
};

export type OpenApiSelectionReport = {
  specUrl: string;
  api: {
    title: string | null;
    version: string | null;
    openapi: string | null;
    operationCount: number;
  };
  goal: string;
  confidence: "high" | "medium" | "low";
  selected: (OpenApiOperationChoice & {
    serverUrl: string | null;
    request: {
      path: Array<Record<string, unknown>>;
      query: Array<Record<string, unknown>>;
      header: Array<Record<string, unknown>>;
      cookie: Array<Record<string, unknown>>;
      body: { contentType: string; schema: unknown } | null;
    };
    security: Array<Record<string, unknown>>;
  }) | null;
  alternatives: OpenApiOperationChoice[];
  warnings: string[];
};

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function stripIpv6Brackets(hostname: string) {
  return hostname.replace(/^\[/, "").replace(/\]$/, "");
}

function isBlockedIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = octets;
  return (
    a === 0 || a === 10 || a === 127 ||
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

function isBlockedIpv6(address: string) {
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

function isBlockedAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return true;
}

async function resolvePublicAddress(hostname: string) {
  const host = stripIpv6Brackets(hostname).replace(/\.$/, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".home.arpa")) {
    throw new Error("Private or local OpenAPI hosts are not allowed.");
  }

  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new Error("Private or reserved OpenAPI hosts are not allowed.");
    return { address: host, family: isIP(host) as 4 | 6 };
  }

  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("OpenAPI host did not resolve.");
  if (addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new Error("OpenAPI host resolves to a private or reserved address.");
  }
  return addresses[0];
}

function validateSpecUrl(input: string) {
  const url = new URL(input);
  if (url.protocol !== "https:") throw new Error("Only public HTTPS OpenAPI URLs are supported.");
  if (url.username || url.password) throw new Error("Credential-bearing OpenAPI URLs are not allowed.");
  if (url.port && url.port !== "443") throw new Error("Custom ports are not supported.");
  url.hash = "";
  return url;
}

async function fetchSpec(url: URL, redirects = 0): Promise<string> {
  if (redirects > MAX_REDIRECTS) throw new Error("Too many OpenAPI redirects.");
  const resolved = await resolvePublicAddress(url.hostname);
  const originalHost = stripIpv6Brackets(url.hostname);

  return await new Promise<string>((resolve, reject) => {
    let settled = false;
    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const finishResolve = (text: string) => {
      if (settled) return;
      settled = true;
      resolve(text);
    };

    const req = https.request({
      hostname: resolved.address,
      family: resolved.family,
      port: 443,
      path: `${url.pathname || "/"}${url.search}`,
      method: "GET",
      servername: isIP(originalHost) ? undefined : originalHost,
      rejectUnauthorized: true,
      headers: {
        Host: url.host,
        Accept: "application/json, application/vnd.oai.openapi+json, */*;q=0.2",
        "User-Agent": "AgentResolver-OpenAPI-Select/0.1",
        Connection: "close"
      },
      timeout: TIMEOUT_MS
    }, (res) => {
      const status = res.statusCode || 0;
      const location = typeof res.headers.location === "string" ? res.headers.location : null;

      if (status >= 300 && status < 400 && location) {
        res.resume();
        try {
          const next = validateSpecUrl(new URL(location, url).toString());
          void fetchSpec(next, redirects + 1).then(finishResolve).catch(finishReject);
        } catch (error) {
          finishReject(error instanceof Error ? error : new Error("Invalid OpenAPI redirect."));
        }
        return;
      }

      if (status < 200 || status >= 300) {
        res.resume();
        finishReject(new Error(`OpenAPI URL returned HTTP ${status || "error"}.`));
        return;
      }

      const declaredLength = Number(res.headers["content-length"] || "0");
      if (Number.isFinite(declaredLength) && declaredLength > MAX_SPEC_BYTES) {
        res.resume();
        finishReject(new Error("OpenAPI document is larger than 512 KB."));
        return;
      }

      const chunks: Buffer[] = [];
      let bytes = 0;
      res.on("data", (chunk: Buffer | string) => {
        if (settled) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > MAX_SPEC_BYTES) {
          res.destroy();
          finishReject(new Error("OpenAPI document is larger than 512 KB."));
          return;
        }
        chunks.push(buffer);
      });
      res.on("end", () => finishResolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", () => finishReject(new Error("OpenAPI response failed.")));
    });

    req.on("timeout", () => req.destroy(new Error("OpenAPI request timed out.")));
    req.on("error", (error) => finishReject(error instanceof Error ? error : new Error("OpenAPI request failed.")));
    req.end();
  });
}

function tokens(value: string) {
  return value
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function resolveRef(root: JsonObject, value: unknown): unknown {
  const candidate = object(value);
  const ref = typeof candidate?.$ref === "string" ? candidate.$ref : null;
  if (!ref || !ref.startsWith("#/")) return value;
  let current: unknown = root;
  for (const rawPart of ref.slice(2).split("/")) {
    const part = rawPart.replace(/~1/g, "/").replace(/~0/g, "~");
    const currentObject = object(current);
    if (!currentObject || !(part in currentObject)) return value;
    current = currentObject[part];
  }
  return current;
}

function parameterSummary(root: JsonObject, raw: unknown) {
  const resolved = object(resolveRef(root, raw));
  if (!resolved) return null;
  const schema = resolveRef(root, resolved.schema);
  return {
    name: typeof resolved.name === "string" ? resolved.name : null,
    in: typeof resolved.in === "string" ? resolved.in : null,
    required: resolved.required === true,
    description: typeof resolved.description === "string" ? resolved.description.slice(0, 400) : null,
    schema
  };
}

function serverUrl(root: JsonObject, operation: JsonObject) {
  const operationServers = Array.isArray(operation.servers) ? operation.servers : [];
  const rootServers = Array.isArray(root.servers) ? root.servers : [];
  const selected = object(operationServers[0]) || object(rootServers[0]);
  if (typeof selected?.url === "string") return selected.url;

  if (typeof root.host === "string") {
    const schemes = Array.isArray(root.schemes) ? root.schemes : [];
    const scheme = typeof schemes[0] === "string" ? schemes[0] : "https";
    const basePath = typeof root.basePath === "string" ? root.basePath : "";
    return `${scheme}://${root.host}${basePath}`;
  }
  return null;
}

function securitySummary(root: JsonObject, operation: JsonObject) {
  const requirements = Array.isArray(operation.security)
    ? operation.security
    : Array.isArray(root.security)
      ? root.security
      : [];
  const components = object(root.components);
  const modernSchemes = object(components?.securitySchemes) || {};
  const legacySchemes = object(root.securityDefinitions) || {};
  const schemes = { ...legacySchemes, ...modernSchemes };

  return requirements.map((raw) => {
    const requirement = object(raw) || {};
    const names = Object.keys(requirement);
    return {
      requiredSchemes: names,
      schemes: names.map((name) => {
        const definition = object(schemes[name]);
        return {
          name,
          type: typeof definition?.type === "string" ? definition.type : null,
          scheme: typeof definition?.scheme === "string" ? definition.scheme : null,
          in: typeof definition?.in === "string" ? definition.in : null
        };
      })
    };
  });
}

function requestBlueprint(root: JsonObject, pathItem: JsonObject, operation: JsonObject) {
  const combined = [
    ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(operation.parameters) ? operation.parameters : [])
  ].map((raw) => parameterSummary(root, raw)).filter(Boolean) as Array<Record<string, unknown>>;

  const byLocation = (location: string) => combined.filter((item) => item.in === location);

  let body: { contentType: string; schema: unknown } | null = null;
  const requestBody = object(resolveRef(root, operation.requestBody));
  const content = object(requestBody?.content);
  if (content) {
    const contentType = "application/json" in content
      ? "application/json"
      : Object.keys(content)[0];
    const media = contentType ? object(content[contentType]) : null;
    if (contentType && media) body = { contentType, schema: resolveRef(root, media.schema) };
  } else {
    const legacyBody = combined.find((item) => item.in === "body");
    if (legacyBody) body = { contentType: "application/json", schema: legacyBody.schema };
  }

  return {
    path: byLocation("path"),
    query: byLocation("query"),
    header: byLocation("header"),
    cookie: byLocation("cookie"),
    body
  };
}

function scoreOperation(goal: string, choice: OpenApiOperationChoice, parameterNames: string[]) {
  const goalTokens = new Set(tokens(goal));
  const candidateText = [
    choice.operationId || "",
    choice.method,
    choice.path,
    choice.summary || "",
    choice.description || "",
    choice.tags.join(" "),
    parameterNames.join(" ")
  ].join(" ");
  const candidateTokens = tokens(candidateText);
  const overlap = [...new Set(candidateTokens)].reduce((score, token) => score + (goalTokens.has(token) ? 2 : 0), 0);
  const lowerGoal = goal.toLowerCase();
  const phraseBonus = choice.tags.reduce((score, tag) => score + (tag.length > 2 && lowerGoal.includes(tag.toLowerCase()) ? 3 : 0), 0);
  const writeIntent = /(create|add|update|change|delete|remove|send|submit|publish|buy|purchase|book|cancel)/i.test(goal);
  const readIntent = /(get|find|list|search|read|lookup|fetch|view|inspect|check|status)/i.test(goal);
  const methodBonus = writeIntent && ["POST", "PUT", "PATCH", "DELETE"].includes(choice.method)
    ? 2
    : readIntent && choice.method === "GET"
      ? 2
      : 0;
  return Math.max(0, overlap + phraseBonus + methodBonus - (choice.deprecated ? 4 : 0));
}

export async function selectOpenApiOperation(specUrlInput: string, goal: string): Promise<OpenApiSelectionReport> {
  const specUrl = validateSpecUrl(specUrlInput);
  await resolvePublicAddress(specUrl.hostname);
  const raw = await fetchSpec(specUrl);

  let root: JsonObject;
  try {
    const parsed = JSON.parse(raw);
    const parsedObject = object(parsed);
    if (!parsedObject) throw new Error("root");
    root = parsedObject;
  } catch {
    throw new Error("OpenAPI document must be valid JSON.");
  }

  const paths = object(root.paths);
  if (!paths) throw new Error("OpenAPI document has no paths object.");

  const warnings: string[] = [];
  const candidates: Array<{
    choice: OpenApiOperationChoice;
    operation: JsonObject;
    pathItem: JsonObject;
    parameterNames: string[];
  }> = [];

  for (const [path, rawPathItem] of Object.entries(paths)) {
    const pathItem = object(resolveRef(root, rawPathItem));
    if (!pathItem) continue;
    for (const method of HTTP_METHODS) {
      const operation = object(pathItem[method]);
      if (!operation) continue;
      const opId = typeof operation.operationId === "string" ? operation.operationId : null;
      if (!opId) warnings.push(`${method.toUpperCase()} ${path} has no operationId.`);
      const parameterNames = [
        ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
        ...(Array.isArray(operation.parameters) ? operation.parameters : [])
      ].map((rawParam) => parameterSummary(root, rawParam)?.name)
        .filter((name): name is string => typeof name === "string");
      const tags = Array.isArray(operation.tags)
        ? operation.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 12)
        : [];
      const baseChoice: OpenApiOperationChoice = {
        operationId: opId,
        method: method.toUpperCase(),
        path,
        summary: typeof operation.summary === "string" ? operation.summary.slice(0, 500) : null,
        description: typeof operation.description === "string" ? operation.description.slice(0, 1200) : null,
        tags,
        deprecated: operation.deprecated === true,
        score: 0
      };
      baseChoice.score = scoreOperation(goal, baseChoice, parameterNames);
      candidates.push({ choice: baseChoice, operation, pathItem, parameterNames });
    }
  }

  candidates.sort((a, b) =>
    b.choice.score - a.choice.score ||
    Number(a.choice.deprecated) - Number(b.choice.deprecated) ||
    a.choice.path.localeCompare(b.choice.path)
  );

  const best = candidates[0] || null;
  const second = candidates[1] || null;
  const confidence: OpenApiSelectionReport["confidence"] = !best || best.choice.score === 0
    ? "low"
    : best.choice.score >= 8 && (!second || best.choice.score >= second.choice.score + 2)
      ? "high"
      : "medium";

  if (confidence === "low") warnings.push("No operation strongly matched the stated goal; review alternatives before execution.");

  const info = object(root.info);
  return {
    specUrl: specUrl.toString(),
    api: {
      title: typeof info?.title === "string" ? info.title : null,
      version: typeof info?.version === "string" ? info.version : null,
      openapi: typeof root.openapi === "string" ? root.openapi : typeof root.swagger === "string" ? root.swagger : null,
      operationCount: candidates.length
    },
    goal,
    confidence,
    selected: best ? {
      ...best.choice,
      serverUrl: serverUrl(root, best.operation),
      request: requestBlueprint(root, best.pathItem, best.operation),
      security: securitySummary(root, best.operation)
    } : null,
    alternatives: candidates.slice(1, 4).map((item) => item.choice),
    warnings: [...new Set(warnings)].slice(0, 12)
  };
}
