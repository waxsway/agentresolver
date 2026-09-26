import { readFileSync, writeFileSync } from "node:fs";
import { CANONICAL_ORIGIN, PAID_CAPABILITY_LIST } from "../src/lib/paidCapabilities";
import { X402_PREFLIGHT_OUTPUT_SCHEMA } from "../src/lib/x402PreflightDiscovery";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PAY_TO = "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8";
const SOLANA_PAY_TO = "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa";
const SOLANA_FEE_PAYER = "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4";
const NETWORK = "eip155:8453";
const SOLANA_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const PAYAI_FACILITATOR_URL = "https://facilitator.payai.network";
const CDP_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";
const CDP_FACILITATOR_CAPABILITIES = new Set(
  (process.env.AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES || "x402-ping")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const CDP_FACILITATOR_ENABLED =
  process.env.AGENTRESOLVER_CDP_FACILITATOR_ENABLED === "1";

function facilitatorFor(capabilityId: string) {
  return CDP_FACILITATOR_ENABLED && CDP_FACILITATOR_CAPABILITIES.has(capabilityId)
    ? CDP_FACILITATOR_URL
    : PAYAI_FACILITATOR_URL;
}

const STRING_OR_NULL = { anyOf: [{ type: "string" }, { type: "null" }] };
const HASH_RESULT_SCHEMA = {
  type: "object",
  required: ["operation", "inputBytes", "encoding", "result"],
  properties: {
    operation: { type: "string" },
    inputBytes: { type: "integer", minimum: 0 },
    encoding: { type: "string" },
    result: { type: "string" }
  }
};
const OUTPUT_SCHEMAS: Record<string, Record<string, unknown>> = {
  "x402-payment-preflight": X402_PREFLIGHT_OUTPUT_SCHEMA,
  "abi-encode": {
    type: "object",
    required: ["types", "encoded", "bytes"],
    properties: {
      types: { type: "array", items: { type: "string" } },
      encoded: { type: "string", pattern: "^0x[0-9a-f]+$" },
      bytes: { type: "integer", minimum: 0 }
    }
  },
  "abi-decode": {
    type: "object",
    required: ["types", "data", "values"],
    properties: {
      types: { type: "array", items: { type: "string" } },
      data: { type: "string", pattern: "^0x[0-9a-fA-F]*$" },
      values: { type: "array" }
    }
  },
  "eip712-hash": {
    type: "object",
    required: ["primaryType", "digest"],
    properties: {
      primaryType: { type: "string" },
      digest: { type: "string", pattern: "^0x[0-9a-f]{64}$" }
    }
  },
  "ens-namehash": {
    type: "object",
    required: ["input", "normalized", "namehash", "labels"],
    properties: {
      input: { type: "string" },
      normalized: { type: "string" },
      namehash: { type: "string", pattern: "^0x[0-9a-f]{64}$" },
      labels: {
        type: "array",
        items: {
          type: "object",
          required: ["label", "labelhash"],
          properties: {
            label: { type: "string" },
            labelhash: { type: "string", pattern: "^0x[0-9a-f]{64}$" }
          }
        }
      }
    }
  },
  "evm-address-checksum": {
    type: "object",
    required: ["input", "checksummed", "lowercase", "eip55"],
    properties: {
      input: { type: "string" },
      checksummed: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
      lowercase: { type: "string", pattern: "^0x[0-9a-f]{40}$" },
      eip55: { const: true }
    }
  },
  keccak256: {
    type: "object",
    required: ["algorithm", "encoding", "inputBytes", "digest"],
    properties: {
      algorithm: { const: "keccak256" },
      encoding: { type: "string", enum: ["utf8", "hex"] },
      inputBytes: { type: "integer", minimum: 0 },
      digest: { type: "string", pattern: "^0x[0-9a-f]{64}$" }
    }
  },
  "solidity-selector": {
    type: "object",
    required: ["signature", "selector", "keccak256"],
    properties: {
      signature: { type: "string" },
      selector: { type: "string", pattern: "^0x[0-9a-f]{8}$" },
      keccak256: { type: "string", pattern: "^0x[0-9a-f]{64}$" }
    }
  },
  "evm-units": {
    type: "object",
    required: ["mode", "value", "decimals", "result", "resultKind"],
    properties: {
      mode: { type: "string", enum: ["parse", "format"] },
      value: { type: "string" },
      decimals: { type: "integer", minimum: 0, maximum: 255 },
      result: { type: "string" },
      resultKind: { type: "string", enum: ["base-units", "decimal"] }
    }
  },
  "x402-ping": {
    type: "object",
    required: ["pong", "settledDelivery", "at", "unixMs", "requestId", "echo"],
    properties: {
      pong: { const: true },
      settledDelivery: { const: true },
      at: { type: "string", format: "date-time" },
      unixMs: { type: "integer" },
      requestId: { type: "string", format: "uuid" },
      echo: STRING_OR_NULL
    }
  },
  sha256: HASH_RESULT_SCHEMA,
  sha512: HASH_RESULT_SCHEMA,
  "hmac-sha256": HASH_RESULT_SCHEMA,
  "base64-encode": HASH_RESULT_SCHEMA,
  "base64-decode": HASH_RESULT_SCHEMA,
  "jwt-decode": {
    type: "object",
    required: ["operation", "inputBytes", "verified", "note", "header", "payload", "signature"],
    properties: {
      operation: { const: "jwt-decode" },
      inputBytes: { type: "integer", minimum: 0 },
      verified: { const: false },
      note: { type: "string" },
      header: {},
      payload: {},
      signature: { type: "string" }
    }
  },
  "json-normalize": {
    type: "object",
    required: ["normalized", "sha256", "bytes"],
    properties: {
      normalized: { type: "string" },
      sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
      bytes: { type: "integer", minimum: 0 }
    }
  },
  "json-schema-validate": {
    type: "object",
    required: ["valid", "errorCount", "errors"],
    properties: {
      valid: { type: "boolean" },
      errorCount: { type: "integer", minimum: 0 },
      errors: {
        type: "array",
        items: {
          type: "object",
          required: ["path", "keyword", "message"],
          properties: {
            path: { type: "string" },
            keyword: { type: "string" },
            message: { type: "string" }
          }
        }
      }
    }
  },
  "url-parse": {
    type: "object",
    required: ["href", "origin", "protocol", "hostname", "port", "pathname", "query", "fragment"],
    properties: {
      href: { type: "string", format: "uri" },
      origin: { type: "string" },
      protocol: { type: "string" },
      hostname: { type: "string" },
      port: STRING_OR_NULL,
      pathname: { type: "string" },
      query: {
        type: "object",
        additionalProperties: {
          anyOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } }
          ]
        }
      },
      fragment: STRING_OR_NULL
    }
  },
  "uuid-v4": {
    type: "object",
    required: ["count", "values"],
    properties: {
      count: { type: "integer", minimum: 1, maximum: 20 },
      values: { type: "array", items: { type: "string", format: "uuid" } }
    }
  },
  slugify: {
    type: "object",
    required: ["slug", "separator", "changed"],
    properties: {
      slug: { type: "string" },
      separator: { type: "string", enum: ["-", "_"] },
      changed: { type: "boolean" }
    }
  }
};

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}
function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

const X402_MANIFEST_PATHS = [
  "public/.well-known/x402",
  "public/.well-known/x402.json"
] as const;

const generatedAt = new Date().toISOString();

const marketplaceServices = PAID_CAPABILITY_LIST.map((product) => ({
  id: product.id,
  name: product.name,
  description: product.description,
  endpoint: `${CANONICAL_ORIGIN}${product.endpoint}`,
  method: "POST",
  price_usdc: String(product.priceUsd),
  price_atomic: Number(product.atomicAmount),
  network: "base",
  network_id: NETWORK,
  asset: BASE_USDC,
  category: "developer",
  tags: [...product.tags, "x402", "agents"].filter((tag, index, all) => all.indexOf(tag) === index),
  owner_url: CANONICAL_ORIGIN,
  owner_contact: "https://github.com/waxsway/agentresolver",
  facilitator: facilitatorFor(product.id),
  x402_version: 2
}));

const x402Manifest = {
  x402Version: 2,
  name: "AgentResolver",
  description: "Seller-side agent distribution for API, MCP, x402 and agent-service providers, with a $5 launch pack, live route checks, provider routing, and supporting buyer-side x402 payment verification. No signup or API key.",
  category: "Developer Tools",
  tags: [
    "agent-distribution",
    "mcp-distribution",
    "api-distribution",
    "provider-launch",
    "x402",
    "agent-payments",
    "payment-canary",
    "payment-preflight",
    "usdc",
    "base",
    "solana"
  ],
  owner_url: CANONICAL_ORIGIN,
  owner_contact: "https://github.com/waxsway/agentresolver",
  homepage: CANONICAL_ORIGIN,
  generated_at: generatedAt,
  pay_to: PAY_TO,
  payment_protocols: ["x402"],
  facilitator: {
    default: PAYAI_FACILITATOR_URL
  },
  openapi: `${CANONICAL_ORIGIN}/openapi.json`,
  mcp: `${CANONICAL_ORIGIN}/mcp`,
  trust: `${CANONICAL_ORIGIN}/.well-known/agentresolver-trust.json`,
  executionEvidence: `${CANONICAL_ORIGIN}/.well-known/agentresolver-evidence.json`,
  verifiedSettlementHistory: `${CANONICAL_ORIGIN}/.well-known/agentresolver-reputation.json`,
  services: marketplaceServices,
  resources: PAID_CAPABILITY_LIST.map((product) => ({
    id: product.id,
    name: product.name,
    endpoint: `${CANONICAL_ORIGIN}${product.endpoint}`,
    method: "POST",
    price_usdc: String(product.priceUsd),
    price_atomic: Number(product.atomicAmount),
    network: "base",
    network_id: NETWORK,
    asset: BASE_USDC,
    category: "developer",
    tags: [...product.tags, "x402", "agents"].filter((tag, index, all) => all.indexOf(tag) === index),
    owner_url: CANONICAL_ORIGIN,
    owner_contact: "https://github.com/waxsway/agentresolver",
    facilitator: facilitatorFor(product.id),
    x402_version: 2,
    resource: `POST ${product.endpoint}`,
    description: product.description,
    price: product.price,
    inputSchema: product.inputSchema,
    outputSchema: OUTPUT_SCHEMAS[product.id] ?? {
      type: "object",
      description: `Structured JSON result from ${product.name}.`,
      additionalProperties: true
    },
    examples: [product.example],
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        asset: BASE_USDC,
        payTo: PAY_TO,
        resource: `${CANONICAL_ORIGIN}${product.endpoint}`,
        amount: product.atomicAmount,
        maxAmountRequired: product.atomicAmount,
        extra: { name: "USD Coin", version: "2" }
      },
      {
        scheme: "exact",
        network: SOLANA_NETWORK,
        asset: SOLANA_USDC,
        payTo: SOLANA_PAY_TO,
        resource: `${CANONICAL_ORIGIN}${product.endpoint}`,
        amount: product.atomicAmount,
        maxAmountRequired: product.atomicAmount,
        extra: { feePayer: SOLANA_FEE_PAYER }
      }
    ]
  })),
  freeDiscovery: {
    mcp: `${CANONICAL_ORIGIN}/mcp`,
    procure: `${CANONICAL_ORIGIN}/api/procure`,
    resolve: `${CANONICAL_ORIGIN}/api/resolve`
  },
  instructions: "Providers launching an API, MCP server, x402 service or agent product should start with POST /api/agent-distribution-pack for the $5 seller launch package, then use /api/provider-launch-check for live route verification. Buyer-side Guard and settlement tools remain available as supporting infrastructure. A 402 is a quote, never spending authorization."
};

for (const path of X402_MANIFEST_PATHS) {
  writeJson(path, x402Manifest);
}

const capabilities = readJson("public/capabilities.json");
const freeCapabilities = Array.isArray(capabilities.capabilities)
  ? capabilities.capabilities.filter((item: any) => Number(item?.priceUsd) === 0)
  : [];
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
    payment: {
      protocol: "x402",
      scheme: "exact",
      network: NETWORK,
      networks: [NETWORK, SOLANA_NETWORK],
      asset: "USDC"
    }
  }))
];
writeJson("public/capabilities.json", capabilities);

const integrations = readJson("public/integrations.json");
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
openapi.info = {
  ...openapi.info,
  title: "AgentResolver — Agent Distribution + x402 Settlement Canary",
  description: "Seller-side agent distribution for APIs, MCP servers, x402 services and agent products. The $5 Agent Distribution Pack audits live machine-readable launch surfaces and returns launch-ready discovery artifacts plus a prioritized distribution sequence. Provider Launch Check adds live route and payment-contract verification. Buyer-side x402 Guard, settlement verification and free procurement remain supporting infrastructure.",
  version: "0.1.6",
  contact: {
    name: "AgentResolver",
    url: "https://github.com/waxsway/agentresolver"
  },
  termsOfService: "https://agentresolver.vercel.app/legal",
  "x-guidance": "Primary seller workflow: call POST /api/agent-distribution-pack for the $5 launch package, publish the returned machine-readable artifacts, then run /api/provider-launch-check against the live route. Buyer-side Guard and settlement verification remain available for autonomous payment workflows. Use POST /api/procure for free constrained capability procurement. Payment is always caller-authorized."
};
openapi.paths ||= {};
if (openapi.paths["/api/resolve"]?.post) {
  openapi.paths["/api/resolve"].post.security = [];
}
if (openapi.paths["/api/health"]?.get) {
  openapi.paths["/api/health"].get.security = [];
}
for (const product of PAID_CAPABILITY_LIST) {
  openapi.paths[product.endpoint] = {
    post: {
      operationId: product.operationId,
      tags: ["Paid Agent Capabilities", ...product.tags],
      summary: product.name,
      description: `Price: ${product.price} USDC on Base or Solana via x402. ${product.description} Use when: ${product.useWhen}`,
      "x-payment-info": {
        price: {
          mode: "fixed",
          currency: "USD",
          amount: String(product.priceUsd)
        },
        protocols: [{ x402: {} }],
        protocol: "x402",
        version: 2,
        scheme: "exact",
        network: NETWORK,
        networks: [NETWORK, SOLANA_NETWORK],
        asset: "USDC",
        paymentOptions: [
          { network: NETWORK, asset: BASE_USDC, payTo: PAY_TO },
          { network: SOLANA_NETWORK, asset: SOLANA_USDC, payTo: SOLANA_PAY_TO }
        ],
        priceUsd: product.priceUsd,
        challengeStatus: 402,
        challengeHeader: "PAYMENT-REQUIRED",
        authorizationHeader: "PAYMENT-SIGNATURE",
        catalog: `${CANONICAL_ORIGIN}/.well-known/x402`
      },
      "x-agentresolver-product": {
        id: product.id,
        costClass: product.costClass,
        useWhen: product.useWhen,
        keywords: product.tags
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
        "200": {
          description: `${product.name} completed after verified payment.`,
          headers: {
            "x-agentresolver-execution-id": {
              description: "Unique identifier for this successful AgentResolver execution.",
              schema: { type: "string", pattern: "^[0-9a-f-]{36}$" }
            },
            "x-agentresolver-response-sha256": {
              description: "SHA-256 of the exact UTF-8 JSON response payload before HTTP content encoding.",
              schema: { type: "string", pattern: "^[0-9a-f]{64}$" }
            },
            "x-agentresolver-deployment": {
              description: "Git commit SHA of the deployed AgentResolver source.",
              schema: { type: "string", pattern: "^[0-9a-f]{40}$" }
            },
            "x-agentresolver-evidence": {
              description: "Machine-readable contract explaining how to verify AgentResolver execution evidence.",
              schema: { type: "string", pattern: "^https://" }
            },
            "x-agentresolver-history": {
              description: "Canonical independently verifiable settlement-history surface available before and after payment.",
              schema: { type: "string", pattern: "^https://" }
            },
            "payment-response": {
              description: "x402 settlement response supplied by the payment middleware after successful settlement.",
              schema: { type: "string" }
            }
          },
          content: {
            "application/json": {
              schema: OUTPUT_SCHEMAS[product.id] ?? {
                type: "object",
                description: `Structured JSON result from ${product.name}.`,
                additionalProperties: true
              }
            }
          }
        },
        "400": { description: "Invalid capability input." },
        "402": {
          description: "x402 payment required.",
          headers: {
            "payment-required": {
              description: "x402 payment challenge. A challenge is a quote and never caller spending authorization.",
              schema: { type: "string" }
            },
            "x-agentresolver-history": {
              description: "Verified settlement history that can be inspected before authorizing payment.",
              schema: { type: "string", pattern: "^https://" }
            }
          }
        },
        "503": { description: "Paid execution temporarily unavailable." }
      }
    }
  };
}
writeJson("public/openapi.json", openapi);
