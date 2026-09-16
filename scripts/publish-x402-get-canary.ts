import { readFileSync, writeFileSync } from "node:fs";

const ENDPOINT = "/api/x402-ping";
const GET_RESOURCE = `GET ${ENDPOINT}`;
const POST_RESOURCE = `POST ${ENDPOINT}`;

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
getResource.description = "Cheapest $0.001 x402 settlement test and USDC payment canary. GET requires no body and lets a funded agent verify wallet, facilitator, payment rail, settlement, and paid delivery end to end.";
getResource.inputSchema = { type: "object", additionalProperties: false };
getResource.examples = [{}];
manifest.resources = [
  getResource,
  ...manifest.resources.filter((item: any) => item.resource !== GET_RESOURCE)
];
writeJson("public/.well-known/x402", manifest);

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
getOperation.summary = "x402 Settlement Test & Payment Canary (GET)";
getOperation.description = "Price: $0.001 USDC on Base or Solana via x402. Cheapest end-to-end x402 settlement test, USDC payment check, wallet/facilitator canary, and paid-delivery verification. GET requires no request body and returns a timestamped pong only after successful payment.";
delete getOperation.requestBody;
getOperation["x-agentresolver-product"] = {
  ...(getOperation["x-agentresolver-product"] ?? {}),
  preferredMethod: "GET",
  backwardCompatibleMethods: ["POST"]
};
pathItem.get = getOperation;
writeJson("public/openapi.json", openapi);
