import { readFileSync, writeFileSync } from "node:fs";

const ENDPOINT = "/api/x402-ping";
const GET_RESOURCE = `GET ${ENDPOINT}`;
const POST_RESOURCE = `POST ${ENDPOINT}`;
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

const getResource = clone(postResource);
getResource.resource = GET_RESOURCE;
getResource.description = "No-body $0.001 x402 settlement test for funded agents. Verifies wallet, facilitator, USDC payment, and paid delivery end-to-end; returns a timestamped pong only after successful settlement.";
getResource.inputSchema = { type: "object", additionalProperties: false };
getResource.examples = [{}];
manifest.resources = [
  getResource,
  ...manifest.resources.filter((item: any) => item.resource !== GET_RESOURCE)
];

const canaryService = manifest.services?.find((item: any) => item.id === "x402-ping");
if (!canaryService) throw new Error("x402-ping service is missing from the generated manifest.");
canaryService.method = "GET";
canaryService.methods = ["GET", "POST"];
canaryService.preferredMethod = "GET";
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
const pathItem = openapi.paths?.[ENDPOINT];
const postOperation = pathItem?.post;
if (!postOperation) throw new Error("x402-ping POST is missing from openapi.json.");
const getOperation = clone(postOperation);
getOperation.operationId = "x402SettlementPingGet";
getOperation.summary = "x402 Settlement Test — Wallet & Facilitator Canary (GET)";
getOperation.description = "Price: $0.001 USDC on Base or Solana via x402. No-body settlement test for funded agents to verify wallet, facilitator, USDC payment, and paid delivery end-to-end before larger purchases. Returns a timestamped pong only after successful settlement.";
delete getOperation.requestBody;
getOperation["x-agentresolver-product"] = {
  ...(getOperation["x-agentresolver-product"] ?? {}),
  preferredMethod: "GET",
  backwardCompatibleMethods: ["POST"]
};
pathItem.get = getOperation;
writeJson("public/openapi.json", openapi);
