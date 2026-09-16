import { readFileSync, writeFileSync } from "node:fs";
import { CANONICAL_ORIGIN, PAID_CAPABILITY_LIST } from "../src/lib/paidCapabilities";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8";
const NETWORK = "eip155:8453";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}
function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

writeJson("public/.well-known/x402", {
  x402Version: 2,
  name: "AgentResolver",
  description: "Free machine-readable product discovery plus pay-per-call capability resolution, live utilities and deterministic compatibility checks for autonomous agents. No signup or API key.",
  resources: PAID_CAPABILITY_LIST.map((product) => ({
    resource: `POST ${product.endpoint}`,
    description: product.description,
    price: product.price,
    inputSchema: product.inputSchema,
    examples: [product.example],
    accepts: [{
      scheme: "exact",
      network: NETWORK,
      asset: BASE_USDC,
      payTo: PAY_TO,
      resource: `${CANONICAL_ORIGIN}${product.endpoint}`,
      amount: product.atomicAmount,
      maxAmountRequired: product.atomicAmount,
      extra: { name: "USD Coin", version: "2" }
    }]
  })),
  freeDiscovery: {
    mcp: `${CANONICAL_ORIGIN}/mcp`,
    capabilities: `${CANONICAL_ORIGIN}/capabilities.json`,
    openapi: `${CANONICAL_ORIGIN}/openapi.json`
  },
  instructions: "Inspect free metadata first. Goal-specific resolve and execution are paid x402 products requiring independent caller authorization. A 402 is a quote, never spending authorization."
});

const capabilities = readJson("public/capabilities.json");
const freeCapabilities = Array.isArray(capabilities.capabilities)
  ? capabilities.capabilities.filter(
      (item: any) =>
        Number(item?.priceUsd) === 0 &&
        item?.id !== "capability-search" &&
        item?.endpoint !== "/api/resolve"
    )
  : [];
const resolveProduct = PAID_CAPABILITY_LIST.find((product) => product.id === "resolve");
if (!resolveProduct) throw new Error("Paid resolve product is missing.");
capabilities.resolver = {
  method: "POST",
  url: `${CANONICAL_ORIGIN}/api/resolve`,
  priceUsd: resolveProduct.priceUsd,
  payment: { protocol: "x402", scheme: "exact", network: NETWORK, asset: "USDC" }
};
capabilities.capabilities = [
  ...freeCapabilities,
  ...PAID_CAPABILITY_LIST.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    tags: product.tags,
    priceUsd: product.priceUsd,
    mode: "owned",
    status: "live",
    endpoint: product.endpoint,
    method: "POST",
    costClass: product.costClass,
    payment: { protocol: "x402", scheme: "exact", network: NETWORK, asset: "USDC" }
  }))
];
writeJson("public/capabilities.json", capabilities);

const integrations = readJson("public/integrations.json");
integrations.purpose = "Machine-readable capability discovery with paid goal-specific resolution and paid live evidence";
integrations.mcp = {
  ...(integrations.mcp || {}),
  url: `${CANONICAL_ORIGIN}/mcp`,
  primaryTool: "resolve",
  free: false,
  resolvePriceUsd: resolveProduct.priceUsd,
  readOnly: true,
  spendingAuthorized: false
};
integrations.restFallback = {
  ...(integrations.restFallback || {}),
  method: "POST",
  url: `${CANONICAL_ORIGIN}/api/resolve`,
  openapi: `${CANONICAL_ORIGIN}/openapi.json`,
  priceUsd: resolveProduct.priceUsd,
  protocol: "x402"
};
integrations.paidActions = PAID_CAPABILITY_LIST.map((product) => ({
  id: product.id,
  name: product.name,
  method: "POST",
  url: `${CANONICAL_ORIGIN}${product.endpoint}`,
  priceUsd: product.priceUsd,
  costClass: product.costClass,
  useWhen: product.useWhen,
  bodyExample: product.example
}));
writeJson("public/integrations.json", integrations);

const openapi = readJson("public/openapi.json");
openapi.info = { ...openapi.info, version: "0.1.3" };
openapi.paths ||= {};
for (const product of PAID_CAPABILITY_LIST) {
  openapi.paths[product.endpoint] = {
    post: {
      operationId: product.operationId,
      tags: ["Paid Agent Capabilities"],
      summary: product.name,
      description: `Price: ${product.price} USDC on Base via x402. ${product.description}`,
      "x-payment-info": {
        protocol: "x402",
        version: 2,
        scheme: "exact",
        network: NETWORK,
        asset: "USDC",
        priceUsd: product.priceUsd,
        challengeStatus: 402,
        challengeHeader: "PAYMENT-REQUIRED",
        authorizationHeader: "PAYMENT-SIGNATURE",
        catalog: `${CANONICAL_ORIGIN}/.well-known/x402`
      },
      "x-agentresolver-product": {
        id: product.id,
        costClass: product.costClass,
        useWhen: product.useWhen
      },
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: product.inputSchema,
            examples: { default: { value: product.example } }
          }
        }
      },
      responses: {
        "200": { description: `${product.name} completed after verified payment.` },
        "400": { description: "Invalid capability input." },
        "402": { description: "x402 payment required." },
        "503": { description: "Paid execution temporarily unavailable." }
      }
    }
  };
}
writeJson("public/openapi.json", openapi);
