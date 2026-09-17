import { readFileSync, writeFileSync } from "node:fs";
import { X402_PING_OUTPUT_SCHEMA } from "../src/lib/x402PingDiscovery";

const ENDPOINT = "/api/x402-ping";
const GET_RESOURCE = `GET ${ENDPOINT}`;
const POST_RESOURCE = `POST ${ENDPOINT}`;
const PREFLIGHT_ENDPOINT = "/api/x402-payment-preflight";
const INTENT_ALIASES = [
  {
    id: "usdc-payment-check",
    name: "USDC Payment Check",
    slug: "usdc-payment-check",
    endpoint: "/api/usdc-payment-check",
    operationId: "usdcPaymentCheck",
    description: "Paid $0.001 USDC x402 endpoint-safety and payment-contract check. Exact-intent alias of AgentResolver's canonical fail-closed x402 payment preflight; execution logic is shared with /api/x402-payment-preflight."
  },
  {
    id: "x402-preflight",
    name: "X402 Preflight",
    slug: "x402-preflight",
    endpoint: "/api/x402-preflight",
    operationId: "x402PreflightExactIntent",
    description: "Paid $0.001 USDC x402 preflight for autonomous buyers. Exact-intent alias of AgentResolver's canonical fail-closed payment preflight; checks endpoint reachability and observed x402 payment terms before caller authorization."
  },
  {
    id: "prepayment-authorization-gate",
    name: "Prepayment Authorization Gate",
    slug: "prepayment-authorization-gate",
    endpoint: "/api/prepayment-authorization-gate",
    operationId: "prepaymentAuthorizationGate",
    description: "Paid $0.001 USDC prepayment authorization gate for autonomous x402 buyers. Returns the same fail-closed eligible/blocked decision and observed payment terms as AgentResolver's canonical payment preflight before the caller authorizes spend."
  },
  {
    id: "api-trust-security-preflight",
    name: "API Trust Security Preflight",
    slug: "api-trust-security-preflight",
    endpoint: "/api/api-trust-security-preflight",
    operationId: "apiTrustSecurityPreflight",
    description: "Paid $0.001 USDC API trust/security preflight focused on x402 payment safety. Checks public endpoint reachability plus observed payment recipient, price, network, asset, scheme and resource binding before caller authorization."
  },
  {
    id: "x402-transaction-path-payment-gate",
    name: "X402 Transaction Path Payment Gate",
    slug: "x402-transaction-path-payment-gate",
    endpoint: "/api/x402-transaction-path-payment-gate",
    operationId: "x402TransactionPathPaymentGate",
    description: "Paid $0.001 USDC x402 transaction-path payment gate for autonomous buyers. Uses AgentResolver's canonical fail-closed preflight engine to check endpoint reachability and observed recipient, amount, network, asset, scheme and resource binding before caller authorization."
  }
] as const;
const X402_MANIFEST_PATHS = [
  "public/.well-known/x402",
  "public/.well-known/x402.json"
] as const;

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const manifest = readJson("public/.well-known/x402");
const postResource = manifest.resources?.find((item: any) => item.resource === POST_RESOURCE);
if (!postResource) throw new Error("x402-ping POST resource is missing from the generated manifest.");
postResource.outputSchema = clone(X402_PING_OUTPUT_SCHEMA);

const getResource = clone(postResource);
getResource.id = "x402-settlement-test";
getResource.name = "x402 Settlement Test";
getResource.slug = "x402-settlement-test";
getResource.method = "GET";
getResource.resource = GET_RESOURCE;
getResource.description = "No-body $0.001 x402 settlement test for funded agents. Verifies wallet, facilitator, USDC payment, and paid delivery end-to-end; returns a timestamped pong plus machine-readable next paid actions only after successful settlement.";
getResource.inputSchema = { type: "object", additionalProperties: false };
getResource.examples = [{}];
getResource.outputSchema = clone(X402_PING_OUTPUT_SCHEMA);

const preflightResource = manifest.resources?.find(
  (item: any) => item.resource === `POST ${PREFLIGHT_ENDPOINT}`
);
if (!preflightResource) {
  throw new Error("x402-payment-preflight POST resource is missing from the generated manifest.");
}

const aliasResources = INTENT_ALIASES.map((alias) => {
  const resource = clone(preflightResource);
  resource.id = alias.id;
  resource.name = alias.name;
  resource.slug = alias.slug;
  resource.endpoint = `https://agentresolver.vercel.app${alias.endpoint}`;
  resource.method = "POST";
  resource.resource = `POST ${alias.endpoint}`;
  resource.description = alias.description;
  if (Array.isArray(resource.accepts)) {
    for (const accept of resource.accepts) {
      accept.resource = `https://agentresolver.vercel.app${alias.endpoint}`;
    }
  }
  return resource;
});
const aliasResourceKeys = new Set(aliasResources.map((item: any) => item.resource));

manifest.resources = [
  getResource,
  ...aliasResources,
  ...manifest.resources.filter(
    (item: any) => item.resource !== GET_RESOURCE && !aliasResourceKeys.has(item.resource)
  )
];
manifest.instructions = "For the cheapest end-to-end paid integration check, call GET /api/x402-ping for $0.001 USDC. A successful canary returns exact next paid actions: POST /api/verified-resolve ($0.02) for one missing capability decision or POST /api/batch-verified-resolve ($0.05) for 2–4 decisions. Before authorizing a separate target x402 purchase, use POST /api/x402-payment-preflight. Exact-intent aliases for the same fail-closed preflight engine are POST /api/usdc-payment-check, POST /api/x402-preflight, POST /api/prepayment-authorization-gate, POST /api/api-trust-security-preflight and POST /api/x402-transaction-path-payment-gate. Free resolve remains available for capability discovery. A 402 is a quote, never spending authorization.";

const canaryService = manifest.services?.find((item: any) => item.id === "x402-ping");
if (!canaryService) throw new Error("x402-ping service is missing from the generated manifest.");
canaryService.method = "GET";
canaryService.methods = ["GET", "POST"];
canaryService.preferredMethod = "GET";

const preflightService = manifest.services?.find(
  (item: any) => item.id === "x402-payment-preflight"
);
if (!preflightService) {
  throw new Error("x402-payment-preflight service is missing from the generated manifest.");
}
const aliasServices = INTENT_ALIASES.map((alias) => {
  const service = clone(preflightService);
  service.id = alias.id;
  service.name = alias.name;
  service.endpoint = `https://agentresolver.vercel.app${alias.endpoint}`;
  service.method = "POST";
  return service;
});
const aliasServiceIds = new Set(aliasServices.map((item: any) => item.id));
manifest.services = [
  ...aliasServices,
  ...manifest.services.filter((item: any) => !aliasServiceIds.has(item.id))
];

for (const path of X402_MANIFEST_PATHS) {
  writeJson(path, manifest);
}

const capabilities = readJson("public/capabilities.json");
const capability = capabilities.capabilities?.find((item: any) => item.id === "x402-ping");
if (!capability) throw new Error("x402-ping is missing from capabilities.json.");
capability.method = "GET";
capability.methods = ["GET", "POST"];
capability.preferredMethod = "GET";
writeJson("public/capabilities.json", capabilities);

const integrations = readJson("public/integrations.json");
const integration = integrations.paidActions?.find((item: any) => item.id === "x402-ping");
if (!integration) throw new Error("x402-ping is missing from integrations.json.");
integration.method = "GET";
integration.methods = ["GET", "POST"];
integration.preferredMethod = "GET";
delete integration.bodyExample;
writeJson("public/integrations.json", integrations);

const openapi = readJson("public/openapi.json");
openapi.info = {
  ...openapi.info,
  version: "0.1.9",
  description: "Machine-readable x402 settlement testing and transaction-path verification for autonomous buyers. For the lowest-friction first paid integration, GET /api/x402-ping settles $0.001 USDC on Base or Solana and returns a timestamped delivery canary plus exact machine-readable next paid actions. After a successful canary, POST /api/verified-resolve costs $0.02 for one missing capability decision and POST /api/batch-verified-resolve costs $0.05 for 2–4 decisions. Before authorizing a separate target x402 purchase, POST /api/x402-payment-preflight checks endpoint reachability, PAYMENT-REQUIRED structure, payTo recipient, quoted price, network, asset, exact scheme and resource binding, then returns a fail-closed eligible/blocked decision and reusable evidence fingerprints. Free capability resolution remains available as a secondary surface.",
  "x-guidance": "For a first paid integration or end-to-end settlement check, use GET /api/x402-ping: it costs $0.001 USDC on Base or Solana, requires no request body, and returns a timestamped pong only after successful x402 settlement. The successful result includes exact next actions: use POST /api/verified-resolve ($0.02) when one missing capability decision needs live external-candidate verification, or POST /api/batch-verified-resolve ($0.05) for 2–4 such decisions. Immediately before authorizing a separate x402 purchase, use POST /api/x402-payment-preflight as the canonical transaction-path gate; it costs $0.001 USDC and returns eligible/blocked, exact observed target payment terms, fail-closed reason codes, structured endpoint/payment evidence, and stable fingerprints. Discovery aliases for that same paid engine include /api/usdc-payment-check, /api/x402-preflight, /api/prepayment-authorization-gate, /api/api-trust-security-preflight and /api/x402-transaction-path-payment-gate. The caller remains the only party that can authorize spend. Use POST /api/resolve only for free capability discovery. Payment is always caller-authorized."
};
const pathItem = openapi.paths?.[ENDPOINT];
const postOperation = pathItem?.post;
if (!postOperation) throw new Error("x402-ping POST is missing from openapi.json.");
const postOutput = postOperation.responses?.["200"]?.content?.["application/json"];
if (!postOutput) throw new Error("x402-ping POST 200 application/json response is missing from openapi.json.");
postOutput.schema = clone(X402_PING_OUTPUT_SCHEMA);

const getOperation = clone(postOperation);
getOperation.operationId = "x402SettlementPingGet";
getOperation.summary = "x402 Settlement Test";
getOperation.description = "Price: $0.001 USDC on Base or Solana via x402. No-body settlement test for funded agents to verify wallet, facilitator, USDC payment, and paid delivery end-to-end before larger purchases. Returns a timestamped pong plus exact machine-readable next paid actions only after successful settlement.";
delete getOperation.requestBody;
getOperation["x-agentresolver-product"] = {
  ...(getOperation["x-agentresolver-product"] ?? {}),
  preferredMethod: "GET",
  backwardCompatibleMethods: ["POST"]
};
pathItem.get = getOperation;

const preflightPost = openapi.paths?.[PREFLIGHT_ENDPOINT]?.post;
if (!preflightPost) throw new Error("x402-payment-preflight POST is missing from openapi.json.");
for (const alias of INTENT_ALIASES) {
  const operation = clone(preflightPost);
  operation.operationId = alias.operationId;
  operation.summary = alias.name;
  operation.description = alias.description;
  openapi.paths[alias.endpoint] = { post: operation };
}
writeJson("public/openapi.json", openapi);
