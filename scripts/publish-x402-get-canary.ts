import { readFileSync, writeFileSync } from "node:fs";
import { X402_PING_OUTPUT_SCHEMA } from "../src/lib/x402PingDiscovery";

const ENDPOINT = "/api/x402-ping";
const GET_RESOURCE = `GET ${ENDPOINT}`;
const POST_RESOURCE = `POST ${ENDPOINT}`;
const PREFLIGHT_ENDPOINT = "/api/x402-payment-preflight";
const USDC_CHECK_ENDPOINT = "/api/usdc-payment-check";
const USDC_CHECK_RESOURCE = `POST ${USDC_CHECK_ENDPOINT}`;
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
const usdcCheckResource = clone(preflightResource);
usdcCheckResource.id = "usdc-payment-check";
usdcCheckResource.name = "USDC Payment Check";
usdcCheckResource.slug = "usdc-payment-check";
usdcCheckResource.endpoint = `https://agentresolver.vercel.app${USDC_CHECK_ENDPOINT}`;
usdcCheckResource.method = "POST";
usdcCheckResource.resource = USDC_CHECK_RESOURCE;
usdcCheckResource.description = "Paid $0.001 USDC x402 endpoint-safety and payment-contract check. Exact-intent alias of AgentResolver's canonical fail-closed x402 payment preflight; execution logic is shared with /api/x402-payment-preflight.";
if (Array.isArray(usdcCheckResource.accepts)) {
  for (const accept of usdcCheckResource.accepts) {
    accept.resource = `https://agentresolver.vercel.app${USDC_CHECK_ENDPOINT}`;
  }
}

manifest.resources = [
  getResource,
  usdcCheckResource,
  ...manifest.resources.filter(
    (item: any) => item.resource !== GET_RESOURCE && item.resource !== USDC_CHECK_RESOURCE
  )
];
manifest.instructions = "For the cheapest end-to-end paid integration check, call GET /api/x402-ping for $0.001 USDC. A successful canary returns exact next paid actions: POST /api/verified-resolve ($0.02) for one missing capability decision or POST /api/batch-verified-resolve ($0.05) for 2–4 decisions. Before authorizing a separate target x402 purchase, use POST /api/x402-payment-preflight. POST /api/usdc-payment-check is the exact-intent alias for the same fail-closed preflight engine. Free resolve remains available for capability discovery. A 402 is a quote, never spending authorization.";

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
const usdcCheckService = clone(preflightService);
usdcCheckService.id = "usdc-payment-check";
usdcCheckService.name = "USDC Payment Check";
usdcCheckService.endpoint = `https://agentresolver.vercel.app${USDC_CHECK_ENDPOINT}`;
usdcCheckService.method = "POST";
manifest.services = [
  usdcCheckService,
  ...manifest.services.filter((item: any) => item.id !== "usdc-payment-check")
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
  version: "0.1.7",
  description: "Machine-readable x402 settlement testing and transaction-path verification for autonomous buyers. For the lowest-friction first paid integration, GET /api/x402-ping settles $0.001 USDC on Base or Solana and returns a timestamped delivery canary plus exact machine-readable next paid actions. After a successful canary, POST /api/verified-resolve costs $0.02 for one missing capability decision and POST /api/batch-verified-resolve costs $0.05 for 2–4 decisions. Before authorizing a separate target x402 purchase, POST /api/x402-payment-preflight checks endpoint reachability, PAYMENT-REQUIRED structure, payTo recipient, quoted price, network, asset, exact scheme and resource binding, then returns a fail-closed eligible/blocked decision and reusable evidence fingerprints. Free capability resolution remains available as a secondary surface.",
  "x-guidance": "For a first paid integration or end-to-end settlement check, use GET /api/x402-ping: it costs $0.001 USDC on Base or Solana, requires no request body, and returns a timestamped pong only after successful x402 settlement. The successful result includes exact next actions: use POST /api/verified-resolve ($0.02) when one missing capability decision needs live external-candidate verification, or POST /api/batch-verified-resolve ($0.05) for 2–4 such decisions. Immediately before authorizing a separate x402 purchase, use POST /api/x402-payment-preflight as the canonical transaction-path gate; it costs $0.001 USDC and returns eligible/blocked, exact observed target payment terms, fail-closed reason codes, structured endpoint/payment evidence, and stable fingerprints. POST /api/usdc-payment-check is a discovery alias for that same paid engine. The caller remains the only party that can authorize spend. Use POST /api/resolve only for free capability discovery. Payment is always caller-authorized."
};
const pathItem = openapi.paths?.[ENDPOINT];
const postOperation = pathItem?.post;
if (!postOperation) throw new Error("x402-ping POST is missing from openapi.json.");
const postOutput = postOperation.responses?.["200"]?.content?.["application/json"];
if (!postOutput) throw new Error("x402-ping POST 200 application/json response is missing from openapi.json.");
postOutput.schema = clone(X402_PING_OUTPUT_SCHEMA);

const getOperation = clone(postOperation);
getOperation.operationId = "x402SettlementTest";
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
const usdcCheckOperation = clone(preflightPost);
usdcCheckOperation.operationId = "usdcPaymentCheck";
usdcCheckOperation.summary = "USDC Payment Check";
usdcCheckOperation.description = "Price: $0.001 USDC on Base or Solana via x402. Exact-intent alias of AgentResolver's canonical fail-closed payment preflight. Checks target endpoint safety and observed x402 payment terms before caller authorization; execution logic is shared with /api/x402-payment-preflight.";
openapi.paths[USDC_CHECK_ENDPOINT] = { post: usdcCheckOperation };
writeJson("public/openapi.json", openapi);
