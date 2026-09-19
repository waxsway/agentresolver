import { readFileSync, writeFileSync } from "node:fs";

const CANONICAL_ORIGIN = "https://agentresolver.vercel.app";
const PING_ID = "x402-ping";
const PING_ENDPOINT = "/api/x402-ping";
const PREFLIGHT_ID = "x402-payment-preflight";
const PREFLIGHT_ENDPOINT = "/api/x402-payment-preflight";
const GUARD_ENDPOINT = "/api/payment-guard";
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

function markGetFirst(item: Record<string, any>) {
  item.method = "GET";
  item.methods = ["GET", "POST"];
  item.preferredMethod = "GET";
}

const pingQueryExample = { echo: "hello" };

const pingQueryParameters = [
  {
    name: "echo",
    in: "query",
    required: false,
    description: "Optional bounded text echoed by the paid settlement response.",
    schema: { type: "string", maxLength: 256 },
    example: "hello"
  }
];

const preflightQueryExample = {
  url: "https://example.com/api",
  method: "GET",
  maxPriceUsd: 0.01
};

const preflightQueryParameters = [
  {
    name: "url",
    in: "query",
    required: true,
    description: "Public HTTPS x402 endpoint to inspect before payment.",
    schema: { type: "string", pattern: "^https://", maxLength: 500 },
    example: "https://example.com/api"
  },
  {
    name: "maxPriceUsd",
    in: "query",
    required: false,
    description: "Optional maximum acceptable target x402 price in USD. Mismatches fail closed.",
    schema: { type: "number", minimum: 0, maximum: 1000 },
    example: 0.01
  },
  {
    name: "expectedPayTo",
    in: "query",
    required: false,
    description: "Optional expected target payment recipient. Mismatches fail closed.",
    schema: { type: "string", minLength: 1, maxLength: 128 }
  },
  {
    name: "expectedNetwork",
    in: "query",
    required: false,
    description: "Optional expected target payment network, for example eip155:8453.",
    schema: { type: "string", maxLength: 128 },
    example: "eip155:8453"
  },
  {
    name: "method",
    in: "query",
    required: false,
    description: "HTTP method AgentResolver should use for the bounded target probe. Defaults to GET.",
    schema: { type: "string", enum: ["GET", "HEAD", "POST"], default: "GET" }
  },
  {
    name: "allowUnpaidPostProbe",
    in: "query",
    required: false,
    description: "Explicitly allow a POST probe to an unprotected target. Defaults to false because POST can have side effects.",
    schema: { type: "boolean", default: false }
  }
];

for (const path of X402_MANIFEST_PATHS) {
  const manifest = readJson(path);

  const pingService = manifest.services?.find((item: any) => item.id === PING_ID);
  if (!pingService) throw new Error(`${PING_ID} service is missing from ${path}.`);
  markGetFirst(pingService);
  pingService.queryExample = pingQueryExample;

  const preflightService = manifest.services?.find((item: any) => item.id === PREFLIGHT_ID);
  if (!preflightService) throw new Error(`${PREFLIGHT_ID} service is missing from ${path}.`);
  markGetFirst(preflightService);
  preflightService.queryExample = preflightQueryExample;
  preflightService.brandName = "AgentResolver Guard";
  preflightService.aliases = [`${CANONICAL_ORIGIN}${GUARD_ENDPOINT}`];
  preflightService.repeatUse = "before_every_autonomous_x402_spend";

  const preflightPost = manifest.resources?.find(
    (item: any) => item.resource === `POST ${PREFLIGHT_ENDPOINT}`
  );
  if (!preflightPost) throw new Error(`${PREFLIGHT_ID} POST resource is missing from ${path}.`);

  const preflightGet = clone(preflightPost);
  preflightGet.id = "x402-payment-preflight-get";
  preflightGet.name = "AgentResolver Guard — GET-first payment verification";
  preflightGet.method = "GET";
  preflightGet.methods = ["GET", "POST"];
  preflightGet.preferredMethod = "GET";
  preflightGet.resource = `GET ${PREFLIGHT_ENDPOINT}`;
  preflightGet.description = "AgentResolver Guard: GET-first $0.001 x402 transaction-path verification gate for autonomous buyers. Run immediately before each target x402 spend. Supply the target endpoint and optional safety assertions as query parameters; AgentResolver returns a fail-closed eligible/blocked decision and observed payment evidence after successful settlement. The caller alone authorizes any spend.";
  preflightGet.inputTransport = "query";
  preflightGet.queryParameters = preflightQueryParameters;
  preflightGet.examples = [preflightQueryExample];
  preflightGet.brandName = "AgentResolver Guard";
  preflightGet.aliases = [`${CANONICAL_ORIGIN}${GUARD_ENDPOINT}`];
  preflightGet.repeatUse = "before_every_autonomous_x402_spend";

  manifest.resources = [
    ...manifest.resources.filter((item: any) => item.resource !== `GET ${PREFLIGHT_ENDPOINT}`),
    preflightGet
  ];

  manifest.instructions = "Use AgentResolver Guard immediately before every autonomous x402 spend: GET /api/x402-payment-preflight?url=<https-endpoint> costs $0.001 USDC and returns a fail-closed eligible/blocked decision, exact target payment terms, reason codes and evidence fingerprints. POST remains supported for body-bearing workflows. For the cheapest end-to-end paid integration check, GET /api/x402-ping costs $0.001 USDC; successful canaries hand off to POST /api/verified-resolve ($0.02) or POST /api/batch-verified-resolve ($0.05). POST /api/procure is the preferred free constrained procurement surface; POST /api/resolve remains free for broad discovery. A 402 is a quote, never spending authorization.";

  writeJson(path, manifest);
}

const capabilities = readJson("public/capabilities.json");
for (const id of [PING_ID, PREFLIGHT_ID]) {
  const capability = capabilities.capabilities?.find((item: any) => item.id === id);
  if (!capability) throw new Error(`${id} is missing from capabilities.json.`);
  markGetFirst(capability);
  if (id === PING_ID) capability.queryExample = pingQueryExample;
  if (id === PREFLIGHT_ID) {
    capability.queryExample = preflightQueryExample;
    capability.brandName = "AgentResolver Guard";
    capability.aliases = [GUARD_ENDPOINT];
    capability.repeatUse = "before_every_autonomous_x402_spend";
  }
}
writeJson("public/capabilities.json", capabilities);

const integrations = readJson("public/integrations.json");
for (const id of [PING_ID, PREFLIGHT_ID]) {
  const integration = integrations.paidActions?.find((item: any) => item.id === id);
  if (!integration) throw new Error(`${id} is missing from integrations.json.`);
  markGetFirst(integration);
  if (id === PING_ID) integration.queryExample = pingQueryExample;
  if (id === PREFLIGHT_ID) {
    integration.queryExample = preflightQueryExample;
    integration.postBodyExample = integration.bodyExample;
    integration.brandName = "AgentResolver Guard";
    integration.aliases = [`${CANONICAL_ORIGIN}${GUARD_ENDPOINT}`];
    integration.repeatUse = "before_every_autonomous_x402_spend";
  }
}
writeJson("public/integrations.json", integrations);

const openapi = readJson("public/openapi.json");
openapi.info = {
  ...openapi.info,
  description: "Machine-readable x402 settlement testing and payment verification for autonomous buyers. Validate x402 payment requirements before wallet signing with AgentResolver Guard: check payTo recipient, quoted USDC price, allowed network, asset, exact scheme and resource binding, then receive a fail-closed eligible/blocked decision and evidence. Start with GET /api/x402-ping for the lowest-friction $0.001 USDC end-to-end settlement canary. A successful canary exposes POST /api/verified-resolve ($0.02) for one missing capability decision and POST /api/batch-verified-resolve ($0.05) for 2–4 decisions. Guard is available through GET /api/payment-guard or canonical GET /api/x402-payment-preflight; POST remains available for body-bearing workflows. POST /api/procure remains available for free constrained capability procurement; POST /api/resolve remains available for broad free capability discovery.",
  "x-guidance": "Validate x402 payment requirements before wallet signing with AgentResolver Guard. Funded agents should prefer GET: call GET /api/payment-guard?url=<https-endpoint> or canonical GET /api/x402-payment-preflight?url=<https-endpoint> for a $0.001 fail-closed check of payTo, quoted USDC price, network, asset, scheme and resource binding. Use GET /api/x402-ping for a $0.001 end-to-end wallet/facilitator/settlement test. After a successful canary, use POST /api/verified-resolve ($0.02) or POST /api/batch-verified-resolve ($0.05). POST /api/x402-payment-preflight remains compatible for body-bearing workflows. POST /api/procure remains available for free constrained capability procurement; POST /api/resolve remains available for broad free capability discovery. A 402 is a quote, not spending authorization."
};

const pingPath = openapi.paths?.[PING_ENDPOINT];
if (!pingPath?.get || !pingPath?.post) {
  throw new Error("x402-ping GET and POST operations must exist before GET-first normalization.");
}
pingPath["x-agentresolver-preferred-method"] = "GET";
pingPath.get["x-agentresolver-product"] = {
  ...(pingPath.get["x-agentresolver-product"] ?? {}),
  preferredMethod: "GET",
  backwardCompatibleMethods: ["POST"]
};
pingPath.get.parameters = pingQueryParameters;
pingPath.get["x-agentresolver-product"].inputTransport = "query";

const preflightPath = openapi.paths?.[PREFLIGHT_ENDPOINT];
const preflightPost = preflightPath?.post;
if (!preflightPost) throw new Error("x402-payment-preflight POST is missing from openapi.json.");

const preflightGet = clone(preflightPost);
preflightGet.operationId = "x402PaymentPreflightPayToVerificationGet";
preflightGet.summary = "Validate x402 payment requirements before wallet signing";
preflightGet.description = "Validate x402 payment requirements before wallet signing. For $0.001 USDC on Base or Solana, AgentResolver Guard checks the live payTo recipient, quoted price against maxPriceUsd, network, asset, exact scheme and resource binding, then returns a fail-closed eligible/blocked decision with observed payment evidence. Run immediately before each autonomous x402 spend.";
delete preflightGet.requestBody;
preflightGet.parameters = preflightQueryParameters;
preflightGet["x-agentresolver-product"] = {
  ...(preflightGet["x-agentresolver-product"] ?? {}),
  preferredMethod: "GET",
  backwardCompatibleMethods: ["POST"],
  inputTransport: "query"
};

preflightPost["x-agentresolver-product"] = {
  ...(preflightPost["x-agentresolver-product"] ?? {}),
  preferredMethod: "GET",
  preferredOperation: "x402PaymentPreflightPayToVerificationGet",
  inputTransport: "json-body"
};
preflightPath.get = preflightGet;
preflightPath["x-agentresolver-preferred-method"] = "GET";

const guardPath = clone(preflightPath);
guardPath["x-agentresolver-alias-of"] = PREFLIGHT_ENDPOINT;
guardPath["x-agentresolver-preferred-method"] = "GET";
if (guardPath.get) {
  guardPath.get.operationId = "agentResolverPaymentGuardGet";
  guardPath.get.summary = "Validate x402 payment requirements before wallet signing";
  guardPath.get["x-agentresolver-alias-of"] = PREFLIGHT_ENDPOINT;
}
if (guardPath.post) {
  guardPath.post.operationId = "agentResolverPaymentGuardPost";
  guardPath.post.summary = "Validate x402 payment requirements before wallet signing — POST compatibility";
  guardPath.post["x-agentresolver-alias-of"] = PREFLIGHT_ENDPOINT;
}
openapi.paths[GUARD_ENDPOINT] = guardPath;

writeJson("public/openapi.json", openapi);
