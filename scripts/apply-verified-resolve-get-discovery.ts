import { readFileSync, writeFileSync } from "node:fs";

const ID = "verified-resolve";
const ENDPOINT = "/api/verified-resolve";
const MANIFEST_PATHS = ["public/.well-known/x402", "public/.well-known/x402.json"] as const;
const queryExample = {
  goal: "Find and verify a paid web search service",
  maxPriceUsd: 0.05,
  protocol: "x402",
  requireHttps: true
};
const queryParameters = [
  { name: "goal", in: "query", required: true, description: "Natural-language capability to procure and live-verify.", schema: { type: "string", minLength: 1, maxLength: 600 }, example: queryExample.goal },
  { name: "url", in: "query", required: false, description: "Optional known candidate URL.", schema: { type: "string", pattern: "^https://", maxLength: 500 } },
  { name: "maxPriceUsd", in: "query", required: false, description: "Optional maximum candidate price in USD.", schema: { type: "number", minimum: 0, maximum: 1000 }, example: queryExample.maxPriceUsd },
  { name: "protocol", in: "query", required: false, description: "Optional procurement protocol constraint.", schema: { type: "string", enum: ["x402", "l402", "mpp", "mcp", "any"] }, example: queryExample.protocol },
  { name: "preferredNetwork", in: "query", required: false, description: "Optional single preferred network for GET compatibility.", schema: { type: "string", maxLength: 128 } },
  { name: "requireHttps", in: "query", required: false, description: "Require HTTPS candidates; defaults true.", schema: { type: "boolean", default: true }, example: true },
  { name: "sideEffect", in: "query", required: false, schema: { type: "string", enum: ["read-only", "state-changing", "any"] } },
  { name: "auth", in: "query", required: false, schema: { type: "string", enum: ["none", "wallet", "api-key", "any"] } },
  { name: "providerOrigin", in: "query", required: false, description: "Optional known provider origin to seed the same procurement universe.", schema: { type: "string", pattern: "^https://[^/]+/?$", maxLength: 500 } }
];

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}
function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function markGetFirst(item: Record<string, any>) {
  item.method = "GET";
  item.methods = ["GET", "POST"];
  item.preferredMethod = "GET";
  item.queryExample = queryExample;
}

for (const path of MANIFEST_PATHS) {
  const manifest = readJson(path);
  const service = manifest.services?.find((item: any) => item.id === ID);
  if (!service) throw new Error(`${ID} service is missing from ${path}.`);
  markGetFirst(service);

  const post = manifest.resources?.find((item: any) => item.resource === `POST ${ENDPOINT}`);
  if (!post) throw new Error(`${ID} POST resource is missing from ${path}.`);

  const get = clone(post);
  get.id = "verified-resolve-get";
  get.name = "Verified Resolve — GET";
  get.method = "GET";
  get.methods = ["GET", "POST"];
  get.preferredMethod = "GET";
  get.resource = `GET ${ENDPOINT}`;
  get.description = "Paid $0.02 GET-first capability procurement plus bounded live verification. Supply goal and optional simple constraints in query parameters; POST remains available for schema-heavy constraints and multiple provider origins.";
  get.inputTransport = "query";
  get.queryParameters = queryParameters;
  get.examples = [queryExample];
  manifest.resources = [get, ...manifest.resources.filter((item: any) => item.resource !== `GET ${ENDPOINT}`)];
  manifest.instructions = `${manifest.instructions ?? ""} For GET-first autonomous buyers, GET ${ENDPOINT}?goal=<capability>&maxPriceUsd=<optional>&protocol=<optional> purchases the same $0.02 Verified Resolve engine; POST remains supported for the full structured input contract.`.trim();
  writeJson(path, manifest);
}

const capabilities = readJson("public/capabilities.json");
const capability = capabilities.capabilities?.find((item: any) => item.id === ID);
if (!capability) throw new Error(`${ID} is missing from capabilities.json.`);
markGetFirst(capability);
writeJson("public/capabilities.json", capabilities);

const integrations = readJson("public/integrations.json");
const integration = integrations.paidActions?.find((item: any) => item.id === ID);
if (!integration) throw new Error(`${ID} is missing from integrations.json.`);
markGetFirst(integration);
integration.postBodyExample = integration.bodyExample;
integration.queryParameters = queryParameters;
writeJson("public/integrations.json", integrations);

const openapi = readJson("public/openapi.json");
const pathItem = openapi.paths?.[ENDPOINT];
const post = pathItem?.post;
if (!post) throw new Error(`${ID} POST operation is missing from openapi.json.`);
const get = clone(post);
get.operationId = "verifiedResolveGet";
get.summary = "Verified Resolve — GET-first live capability procurement";
get.description = "Price: $0.02 USDC via x402. GET-first compatibility surface for the same Verified Resolve engine: procure a missing capability and perform bounded live verification against supported MCP/x402 candidates. Query transport supports the common goal, URL, budget, protocol, network, HTTPS, side-effect, auth and one provider-origin seed. Use POST for schema-heavy constraints or multiple provider origins.";
delete get.requestBody;
get.parameters = queryParameters;
get["x-agentresolver-product"] = { ...(get["x-agentresolver-product"] ?? {}), preferredMethod: "GET", backwardCompatibleMethods: ["POST"], inputTransport: "query" };
post["x-agentresolver-product"] = { ...(post["x-agentresolver-product"] ?? {}), preferredMethod: "GET", preferredOperation: "verifiedResolveGet", inputTransport: "json-body" };
pathItem.get = get;
pathItem["x-agentresolver-preferred-method"] = "GET";
openapi.info = {
  ...(openapi.info ?? {}),
  description: `${openapi.info?.description ?? ""} Verified Resolve is also available through GET ${ENDPOINT}?goal=<capability> for $0.02 GET-first machine purchases.`.trim(),
  "x-guidance": `${openapi.info?.["x-guidance"] ?? ""} GET-first marketplaces may purchase Verified Resolve at ${ENDPOINT}?goal=<capability>; use POST when full structured constraints are required.`.trim()
};
writeJson("public/openapi.json", openapi);
