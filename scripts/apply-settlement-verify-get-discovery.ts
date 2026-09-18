import { readFileSync, writeFileSync } from "node:fs";

const ID = "base-usdc-settlement-verify";
const ENDPOINT = "/api/base-usdc-settlement-verify";
const MANIFEST_PATHS = ["public/.well-known/x402", "public/.well-known/x402.json"] as const;

const queryExample = {
  transactionHash: `0x${"00".repeat(32)}`,
  expectedAmountAtomic: "1000",
  minimumConfirmations: 1
};

const queryParameters = [
  {
    name: "transactionHash",
    in: "query",
    required: true,
    description: "Base transaction hash to verify.",
    schema: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" }
  },
  {
    name: "expectedPayTo",
    in: "query",
    required: false,
    description: "Optional expected USDC recipient. Mismatch fails closed.",
    schema: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" }
  },
  {
    name: "expectedAmountAtomic",
    in: "query",
    required: false,
    description: "Optional expected USDC amount in 6-decimal atomic units.",
    schema: { type: "string", pattern: "^[0-9]+$" }
  },
  {
    name: "minimumConfirmations",
    in: "query",
    required: false,
    description: "Minimum Base confirmation depth required for settlementVerified=true.",
    schema: { type: "integer", minimum: 1, maximum: 10000, default: 1 }
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
  item.queryExample = queryExample;
}

for (const path of MANIFEST_PATHS) {
  const manifest = readJson(path);
  const service = manifest.services?.find((item: any) => item.id === ID);
  if (!service) throw new Error(`${ID} service missing from ${path}`);
  markGetFirst(service);

  const post = manifest.resources?.find((item: any) => item.resource === `POST ${ENDPOINT}`);
  if (!post) throw new Error(`${ID} POST resource missing from ${path}`);
  const get = clone(post);
  get.id = "base-usdc-settlement-verify-get";
  get.name = "Base USDC Settlement Verify";
  get.method = "GET";
  get.methods = ["GET", "POST"];
  get.preferredMethod = "GET";
  get.resource = `GET ${ENDPOINT}`;
  get.description = "Paid $0.001 GET for post-payment Base USDC settlement evidence. Verifies successful transaction receipt, canonical USDC Transfer logs, confirmation depth, and optional expected payee/amount assertions. Does not prove provider legitimacy or fulfillment.";
  get.inputTransport = "query";
  get.queryParameters = queryParameters;
  get.examples = [queryExample];

  manifest.resources = [
    ...manifest.resources.filter((item: any) => item.resource !== `GET ${ENDPOINT}`),
    get
  ];
  writeJson(path, manifest);
}

const capabilities = readJson("public/capabilities.json");
const capability = capabilities.capabilities?.find((item: any) => item.id === ID);
if (!capability) throw new Error(`${ID} missing from capabilities.json`);
markGetFirst(capability);
writeJson("public/capabilities.json", capabilities);

const integrations = readJson("public/integrations.json");
const integration = integrations.paidActions?.find((item: any) => item.id === ID);
if (!integration) throw new Error(`${ID} missing from integrations.json`);
markGetFirst(integration);
integration.postBodyExample = integration.bodyExample;
writeJson("public/integrations.json", integrations);

const openapi = readJson("public/openapi.json");
const pathItem = openapi.paths?.[ENDPOINT];
const post = pathItem?.post;
if (!post) throw new Error(`${ID} POST operation missing from openapi.json`);

const get = clone(post);
get.operationId = "baseUsdcSettlementVerifyGet";
get.summary = "Verify Base USDC settlement receipt";
get.description = "Paid $0.001 GET for transaction-level Base USDC settlement evidence after payment. Checks successful receipt, canonical USDC Transfer logs, confirmations, and optional expected payee/amount assertions.";
delete get.requestBody;
get.parameters = queryParameters;
get["x-agentresolver-product"] = {
  ...(get["x-agentresolver-product"] ?? {}),
  preferredMethod: "GET",
  backwardCompatibleMethods: ["POST"],
  inputTransport: "query"
};
post["x-agentresolver-product"] = {
  ...(post["x-agentresolver-product"] ?? {}),
  preferredMethod: "GET",
  preferredOperation: "baseUsdcSettlementVerifyGet",
  inputTransport: "json-body"
};
pathItem.get = get;
pathItem["x-agentresolver-preferred-method"] = "GET";
writeJson("public/openapi.json", openapi);
