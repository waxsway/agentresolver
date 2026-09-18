import { readFileSync, writeFileSync } from "node:fs";

const CANONICAL_ORIGIN = "https://agentresolver.vercel.app";
const ID = "x402-settlement-verify";
const ENDPOINT = "/api/x402-settlement-verify";
const MANIFEST_PATHS = [
  "public/.well-known/x402",
  "public/.well-known/x402.json"
] as const;

const queryExample = {
  txHash: "0x7729766d8615c6bd052340bddc95019be20afd78c2cd39faa4812775e3227b72",
  expectedPayTo: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8",
  expectedAmountAtomic: "1000"
};

const queryParameters = [
  {
    name: "txHash",
    in: "query",
    required: true,
    description: "Base mainnet transaction hash returned by an x402 settlement.",
    schema: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
    example: queryExample.txHash
  },
  {
    name: "expectedPayTo",
    in: "query",
    required: false,
    description: "Optional expected Base USDC recipient. A mismatch fails closed.",
    schema: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
    example: queryExample.expectedPayTo
  },
  {
    name: "expectedAmountAtomic",
    in: "query",
    required: false,
    description: "Optional expected USDC amount in six-decimal atomic units. A mismatch fails closed.",
    schema: { type: "string", pattern: "^[0-9]{1,78}$" },
    example: queryExample.expectedAmountAtomic
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
  if (!service) throw new Error(`${ID} service is missing from ${path}.`);
  markGetFirst(service);
  service.repeatUse = "after_base_x402_settlement_when_receipt_evidence_is_needed";

  const post = manifest.resources?.find(
    (item: any) => item.resource === `POST ${ENDPOINT}`
  );
  if (!post) throw new Error(`${ID} POST resource is missing from ${path}.`);

  const get = clone(post);
  get.id = "x402-settlement-verify-get";
  get.name = "x402 Settlement Verify — GET-first Base USDC receipt evidence";
  get.method = "GET";
  get.methods = ["GET", "POST"];
  get.preferredMethod = "GET";
  get.resource = `GET ${ENDPOINT}`;
  get.description =
    "GET-first $0.001 x402 exact-scheme settlement verification. Supply a Base transaction hash and optional expected recipient/amount as query parameters; after AgentResolver payment settles, the response independently checks the public Base receipt, EIP-3009 transaction shape, USDC Transfer logs and confirmation depth. This proves settlement evidence, not provider legitimacy.";
  get.inputTransport = "query";
  get.queryParameters = queryParameters;
  get.examples = [queryExample];
  get.repeatUse = "after_base_x402_settlement_when_receipt_evidence_is_needed";

  manifest.resources = [
    get,
    ...manifest.resources.filter(
      (item: any) => item.resource !== `GET ${ENDPOINT}`
    )
  ];
  manifest.instructions =
    `${manifest.instructions ?? ""} After a Base x402 payment, GET ${ENDPOINT}?txHash=<hash> provides $0.001 independent on-chain EIP-3009/USDC settlement evidence with optional expected recipient and amount assertions.`.trim();
  writeJson(path, manifest);
}

const capabilities = readJson("public/capabilities.json");
const capability = capabilities.capabilities?.find((item: any) => item.id === ID);
if (!capability) throw new Error(`${ID} is missing from capabilities.json.`);
markGetFirst(capability);
capability.repeatUse = "after_base_x402_settlement_when_receipt_evidence_is_needed";
writeJson("public/capabilities.json", capabilities);

const integrations = readJson("public/integrations.json");
const integration = integrations.paidActions?.find((item: any) => item.id === ID);
if (!integration) throw new Error(`${ID} is missing from integrations.json.`);
markGetFirst(integration);
integration.postBodyExample = integration.bodyExample;
integration.repeatUse = "after_base_x402_settlement_when_receipt_evidence_is_needed";
writeJson("public/integrations.json", integrations);

const openapi = readJson("public/openapi.json");
const pathItem = openapi.paths?.[ENDPOINT];
const post = pathItem?.post;
if (!post) throw new Error(`${ID} POST operation is missing from openapi.json.`);

const get = clone(post);
get.operationId = "x402SettlementVerifyGet";
get.summary = "Verify Base x402 settlement receipt";
get.description =
  "Price: $0.001 USDC via x402. GET-first independent verification of a Base USDC EIP-3009 settlement from its transaction hash. Confirms receipt success, transaction payment shape, USDC Transfer logs, confirmation depth, and optional expected payTo/amount assertions. Point-in-time settlement evidence only; not provider identity or fulfillment verification.";
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
  preferredOperation: "x402SettlementVerifyGet",
  inputTransport: "json-body"
};

pathItem.get = get;
pathItem["x-agentresolver-preferred-method"] = "GET";

openapi.info = {
  ...(openapi.info ?? {}),
  description:
    `${openapi.info?.description ?? ""} AgentResolver also exposes GET ${ENDPOINT} for $0.001 independent Base-USDC x402 settlement receipt verification after payment.`.trim(),
  "x-guidance":
    `${openapi.info?.["x-guidance"] ?? ""} After a Base payment returns a transaction hash, use GET ${ENDPOINT}?txHash=<hash> when independent EIP-3009/USDC receipt evidence is needed.`.trim()
};
writeJson("public/openapi.json", openapi);
