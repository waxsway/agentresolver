import { readFileSync, writeFileSync } from "node:fs";

const CANONICAL_ORIGIN = "https://agentresolver.vercel.app";
const ID = "provider-launch-check";
const ENDPOINT = "/api/provider-launch-check";
const MANIFEST_PATHS = [
  "public/.well-known/x402",
  "public/.well-known/x402.json"
] as const;

const referenceQueryExample = {
  providerId: "agentresolver-reference",
  providerName: "AgentResolver Reference Provider",
  capabilityId: "x402-ping",
  name: "AgentResolver x402 Settlement Ping",
  description: "Reference x402 service used to demonstrate paid provider launch verification.",
  origin: CANONICAL_ORIGIN,
  endpoint: CANONICAL_ORIGIN + "/api/x402-ping",
  method: "GET",
  probeUrl: CANONICAL_ORIGIN + "/api/x402-ping",
  priceUsd: 0.001,
  network: "eip155:8453",
  tag: ["x402", "provider-launch", "reference"]
};

const queryParameters = [
  { name: "providerId", in: "query", required: false, schema: { type: "string", maxLength: 80 }, example: referenceQueryExample.providerId },
  { name: "providerName", in: "query", required: false, schema: { type: "string", maxLength: 120 }, example: referenceQueryExample.providerName },
  { name: "capabilityId", in: "query", required: false, schema: { type: "string", maxLength: 120 }, example: referenceQueryExample.capabilityId },
  { name: "name", in: "query", required: false, schema: { type: "string", maxLength: 160 }, example: referenceQueryExample.name },
  { name: "description", in: "query", required: false, schema: { type: "string", maxLength: 500 }, example: referenceQueryExample.description },
  { name: "origin", in: "query", required: false, schema: { type: "string", pattern: "^https://", maxLength: 2048 }, example: referenceQueryExample.origin },
  { name: "endpoint", in: "query", required: false, schema: { type: "string", pattern: "^https://", maxLength: 2048 }, example: referenceQueryExample.endpoint },
  { name: "method", in: "query", required: false, schema: { type: "string", enum: ["GET", "POST"], default: "GET" }, example: "GET" },
  { name: "probeUrl", in: "query", required: false, schema: { type: "string", pattern: "^https://", maxLength: 2048 }, example: referenceQueryExample.probeUrl },
  { name: "priceUsd", in: "query", required: false, schema: { type: "number", minimum: 0, maximum: 1000 }, example: 0.001 },
  { name: "network", in: "query", required: false, schema: { type: "string", maxLength: 120 }, example: "eip155:8453" },
  {
    name: "tag",
    in: "query",
    required: false,
    style: "form",
    explode: true,
    schema: { type: "array", maxItems: 20, items: { type: "string", maxLength: 80 } },
    example: referenceQueryExample.tag
  }
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
  item.queryExample = referenceQueryExample;
}

for (const path of MANIFEST_PATHS) {
  const manifest = readJson(path);
  const service = manifest.services?.find((item: any) => item.id === ID);
  if (!service) throw new Error(ID + " service is missing from " + path + ".");
  markGetFirst(service);
  service.audience = "machine-service providers";
  service.repeatUse = "before_submitting_or_refresh_checking_a_provider_route";

  const post = manifest.resources?.find((item: any) => item.resource === "POST " + ENDPOINT);
  if (!post) throw new Error(ID + " POST resource is missing from " + path + ".");

  const get = clone(post);
  get.id = "provider-launch-check-get";
  get.name = "Provider Launch Check — GET reference contract";
  get.method = "GET";
  get.methods = ["GET", "POST"];
  get.preferredMethod = "GET";
  get.resource = "GET " + ENDPOINT;
  get.description =
    "GET-first $0.05 USDC seller-side launch verification for machine-service providers. A no-parameter GET validates AgentResolver's known-good reference provider; optional provider fields can be supplied as query parameters. Production sellers should use POST for their complete onboarding packet. Passing verifies current technical/x402 readiness and does not buy ranking or guarantee activation.";
  get.inputTransport = "query";
  get.queryParameters = queryParameters;
  get.examples = [referenceQueryExample];
  get.audience = "machine-service providers";
  get.repeatUse = "before_submitting_or_refresh_checking_a_provider_route";

  manifest.resources = [
    get,
    ...manifest.resources.filter((item: any) => item.resource !== "GET " + ENDPOINT)
  ];
  manifest.instructions =
    ((manifest.instructions ?? "") +
      " Machine-service sellers can use GET " + ENDPOINT +
      " for a $0.05 reference launch verification or POST the full provider packet; passing does not buy organic ranking or guarantee activation.").trim();
  writeJson(path, manifest);
}

const capabilities = readJson("public/capabilities.json");
const capability = capabilities.capabilities?.find((item: any) => item.id === ID);
if (!capability) throw new Error(ID + " is missing from capabilities.json.");
markGetFirst(capability);
capability.audience = "machine-service providers";
capability.repeatUse = "before_submitting_or_refresh_checking_a_provider_route";
writeJson("public/capabilities.json", capabilities);

const integrations = readJson("public/integrations.json");
const integration = integrations.paidActions?.find((item: any) => item.id === ID);
if (!integration) throw new Error(ID + " is missing from integrations.json.");
markGetFirst(integration);
integration.postBodyExample = integration.bodyExample;
integration.audience = "machine-service providers";
integration.repeatUse = "before_submitting_or_refresh_checking_a_provider_route";
writeJson("public/integrations.json", integrations);

const openapi = readJson("public/openapi.json");
const pathItem = openapi.paths?.[ENDPOINT];
const post = pathItem?.post;
if (!post) throw new Error(ID + " POST operation is missing from openapi.json.");

const get = clone(post);
get.operationId = "providerLaunchCheckGet";
get.summary = "Verify a provider route before AgentResolver distribution";
get.description =
  "Price: $0.05 USDC via x402. GET-first seller-side launch verification for machine-service providers. With no query parameters, AgentResolver verifies a known-good reference x402 provider so autonomous buyer/probe systems can exercise the product end to end. Optional provider fields can be supplied as query parameters; production sellers should use POST for the complete onboarding packet. Passing verifies current technical/x402 readiness and does not buy ranking or guarantee activation.";
delete get.requestBody;
get.parameters = queryParameters;
get["x-agentresolver-product"] = {
  ...(get["x-agentresolver-product"] ?? {}),
  preferredMethod: "GET",
  backwardCompatibleMethods: ["POST"],
  inputTransport: "query",
  referenceMode: true,
  audience: "machine-service providers"
};

post["x-agentresolver-product"] = {
  ...(post["x-agentresolver-product"] ?? {}),
  preferredMethod: "GET",
  preferredOperation: "providerLaunchCheckGet",
  inputTransport: "json-body",
  audience: "machine-service providers"
};

pathItem.get = get;
pathItem["x-agentresolver-preferred-method"] = "GET";

openapi.info = {
  ...(openapi.info ?? {}),
  description:
    ((openapi.info?.description ?? "") +
      " Machine-service providers can purchase GET /api/provider-launch-check for a $0.05 reference launch verification or POST their full provider packet before requesting AgentResolver distribution.").trim(),
  "x-guidance":
    ((openapi.info?.["x-guidance"] ?? "") +
      " Sellers: use GET /api/provider-launch-check for a $0.05 reference verification, then POST the full provider packet for production onboarding; passing does not buy ranking or guarantee activation.").trim()
};
writeJson("public/openapi.json", openapi);
