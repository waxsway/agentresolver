import { readFileSync, writeFileSync } from "node:fs";

const KEEP_PAID_IDS = new Set([
  "x402-ping",
  "x402-payment-preflight",
  "x402-settlement-verify",
  "verified-resolve",
  "batch-verified-resolve",
  "managed-monitor-30d",
  "agent-distribution-pack",
  "provider-launch-check"
]);

const KEEP_INTENT_ALIAS_IDS = new Set([
  "usdc-payment-check",
  "x402-preflight",
  "prepayment-authorization-gate",
  "api-trust-security-preflight",
  "x402-transaction-path-payment-gate"
]);

const KEEP_OPENAPI_PATHS = new Set([
  "/api/procure",
  "/api/resolve",
  "/api/providers",
  "/api/provider-bootstrap",
  "/api/provider-attribution-verify",
  "/api/provider-success-fee-quote",
  "/api/provider-success-fee-verify",
  "/api/health",
  "/api/service-monitor",
  "/api/managed-monitor-status",
  "/api/managed-monitor-30d",
  "/api/agent-distribution-preview",
  "/api/x402-ping",
  "/api/x402-payment-preflight",
  "/api/payment-guard",
  "/api/x402-settlement-verify",
  "/api/verified-resolve",
  "/api/batch-verified-resolve",
  "/api/managed-monitor-30d",
  "/api/agent-distribution-pack",
  "/api/provider-launch-check",
  "/api/usdc-payment-check",
  "/api/x402-preflight",
  "/api/prepayment-authorization-gate",
  "/api/api-trust-security-preflight",
  "/api/x402-transaction-path-payment-gate"
]);

const KEEP_RESOURCE_PATHS = new Set([
  "/api/x402-ping",
  "/api/x402-payment-preflight",
  "/api/payment-guard",
  "/api/x402-settlement-verify",
  "/api/verified-resolve",
  "/api/batch-verified-resolve",
  "/api/agent-distribution-pack",
  "/api/provider-launch-check",
  "/api/usdc-payment-check",
  "/api/x402-preflight",
  "/api/prepayment-authorization-gate",
  "/api/api-trust-security-preflight",
  "/api/x402-transaction-path-payment-gate"
]);

const MANIFEST_PATHS = [
  "public/.well-known/x402",
  "public/.well-known/x402.json"
] as const;

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function resourcePath(item: Record<string, any>) {
  const resource = String(item.resource ?? "");
  const match = resource.match(/^(?:GET|POST|HEAD)\s+(\/\S+)$/);
  return match?.[1] ?? "";
}

for (const path of MANIFEST_PATHS) {
  const manifest = readJson(path);
  manifest.services = (manifest.services ?? []).filter((item: any) =>
    KEEP_PAID_IDS.has(String(item?.id ?? "")) ||
    KEEP_INTENT_ALIAS_IDS.has(String(item?.id ?? ""))
  );
  manifest.resources = (manifest.resources ?? []).filter((item: any) =>
    KEEP_RESOURCE_PATHS.has(resourcePath(item))
  );
  manifest.description =
    "Continuous API, MCP, and x402 compatibility monitoring for agent-service providers. Run a free live service snapshot, then use the $19 30-day managed monitor for hourly machine-readiness, MCP tool-contract, and x402 payment-contract drift checks. Agent Distribution remains available for launch work, and payment verification for autonomous buyers remains supporting infrastructure.";
  manifest.tags = [
    "api-monitoring",
    "mcp-monitoring",
    "x402-monitoring",
    "agent-compatibility",
    "schema-drift",
    "payment-drift",
    "agent-distribution",
    "x402",
    "payment-canary"
  ];
  manifest.freeDiscovery = {
    ...(manifest.freeDiscovery ?? {}),
    mcp: "https://agentresolver.vercel.app/mcp",
    procure: "https://agentresolver.vercel.app/api/procure",
    resolve: "https://agentresolver.vercel.app/api/resolve",
    distributionPreview:
      "https://agentresolver.vercel.app/api/agent-distribution-preview?origin=https%3A%2F%2Fapi.example.com",
    serviceMonitor:
      "https://agentresolver.vercel.app/api/service-monitor?origin=https%3A%2F%2Fapi.example.com",
    managedMonitorStatus:
      "https://agentresolver.vercel.app/api/managed-monitor-status?id=mon_<monitor-id>"
  };
  manifest.instructions =
    "For API, MCP, x402, and agent-service providers, start with free GET or POST /api/service-monitor to capture a current compatibility snapshot and drift fingerprint. POST /api/managed-monitor-30d ($19 USDC) activates 30 days of hourly managed checks with durable public status. For launch/distribution work, start with GET or POST /api/provider-launch-check ($0.05), then use POST /api/agent-distribution-pack ($5) when discovery artifacts are needed. Free procurement remains at POST /api/procure. Buyer-side payment verification remains supporting infrastructure through GET /api/x402-ping, GET /api/x402-settlement-verify, and GET /api/x402-payment-preflight. A 402 is a quote, never spending authorization.";
  writeJson(path, manifest);
}

const capabilities = readJson("public/capabilities.json");
capabilities.capabilities = (capabilities.capabilities ?? []).filter((item: any) => {
  const priceUsd = Number(item?.priceUsd ?? 0);
  return priceUsd === 0 || KEEP_PAID_IDS.has(String(item?.id ?? ""));
});
if (!capabilities.capabilities.some((item: any) => item?.id === "agent-distribution-preview")) {
  capabilities.capabilities.unshift({
    id: "agent-distribution-preview",
    name: "Agent Distribution Preview",
    description:
      "Free bounded preview for API/MCP sellers: inspect one public origin, see the current machine-readiness score and highest-priority discovery gaps, then upgrade to the $5 Distribution Pack for generated launch artifacts and the full publication sequence.",
    tags: ["agent distribution", "api distribution", "mcp distribution", "seller preview"],
    priceUsd: 0,
    mode: "owned",
    status: "live",
    endpoint: "/api/agent-distribution-preview",
    method: "GET"
  });
}
if (!capabilities.capabilities.some((item: any) => item?.id === "service-monitor")) {
  capabilities.capabilities.unshift({
    id: "service-monitor",
    name: "API + MCP Service Monitor Snapshot",
    description:
      "Free bounded live snapshot for one public service: agent-readiness, optional MCP initialize/tools-list contract fingerprint, optional GET-safe x402 contract evidence, and drift comparison against a prior snapshot.",
    tags: ["api monitoring", "mcp monitoring", "x402 monitoring", "schema drift", "agent compatibility"],
    priceUsd: 0,
    mode: "owned",
    status: "live",
    endpoint: "/api/service-monitor",
    method: "GET"
  });
}
writeJson("public/capabilities.json", capabilities);

const integrations = readJson("public/integrations.json");
integrations.paidActions = (integrations.paidActions ?? []).filter((item: any) =>
  KEEP_PAID_IDS.has(String(item?.id ?? ""))
);
integrations.providerNetwork = {
  ...(integrations.providerNetwork ?? {}),
  registry: "https://agentresolver.vercel.app/api/providers",
  execute: "https://agentresolver.vercel.app/api/execute",
  contract: "https://agentresolver.vercel.app/provider-integration.json",
  bootstrap: "https://agentresolver.vercel.app/api/provider-bootstrap",
  manifestPath: "/.well-known/agentresolver-provider.json",
  attributionHeader: "x-agentresolver-attribution-id",
  attributionReceiptHeader: "x-agentresolver-attribution-receipt",
  enrollment: "domain-controlled-well-known",
  immediateSeedField: "providerOrigins",
  arbitraryProxying: false,
  callerSpendingAuthorized: false,
  providerFundedCommerce: {
    ...(integrations.providerNetwork?.providerFundedCommerce ?? {}),
    successFeeBps: 200,
    minimumSuccessFeeUsd: 0.001,
    conversionVerify: "https://agentresolver.vercel.app/api/provider-attribution-verify",
    feeQuote: "https://agentresolver.vercel.app/api/provider-success-fee-quote",
    feeVerify: "https://agentresolver.vercel.app/api/provider-success-fee-verify",
    buyerExtraFeeUsd: 0
  }
};
writeJson("public/integrations.json", integrations);

const openapi = readJson("public/openapi.json");
openapi.paths = Object.fromEntries(
  Object.entries(openapi.paths ?? {}).filter(([path]) => KEEP_OPENAPI_PATHS.has(path))
);
openapi.paths["/api/service-monitor"] = {
  get: {
    operationId: "serviceMonitorSnapshot",
    tags: ["Managed Monitoring"],
    summary: "Capture a live API/MCP/x402 compatibility snapshot",
    description:
      "Free bounded snapshot for one public origin. Optionally performs a same-origin MCP initialize + tools/list and a same-origin GET-safe x402 contract inspection. Returns a stable fingerprint for drift detection.",
    security: [],
    parameters: [
      { name: "origin", in: "query", required: true, schema: { type: "string", format: "uri" } },
      { name: "mcpEndpoint", in: "query", required: false, schema: { type: "string", format: "uri" } },
      { name: "x402Endpoint", in: "query", required: false, schema: { type: "string", format: "uri" } },
      { name: "baselineFingerprint", in: "query", required: false, schema: { type: "string", pattern: "^[0-9a-f]{64}$" } }
    ],
    responses: {
      "200": { description: "Current service snapshot and drift fingerprint." },
      "400": { description: "Invalid, private, cross-origin, or malformed monitor request." }
    }
  },
  post: {
    operationId: "serviceMonitorSnapshotWithBaseline",
    tags: ["Managed Monitoring"],
    summary: "Capture a live service snapshot and compare an exact prior snapshot",
    description:
      "Same bounded monitor as GET, with an optional prior snapshot in the JSON body so AgentResolver can return field-level drift.",
    security: [],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["origin"],
            additionalProperties: false,
            properties: {
              label: { type: "string", maxLength: 120 },
              origin: { type: "string", format: "uri" },
              mcpEndpoint: { type: "string", format: "uri" },
              x402Endpoint: { type: "string", format: "uri" },
              baselineFingerprint: { type: "string", pattern: "^[0-9a-f]{64}$" },
              baselineSnapshot: { type: "object" }
            }
          }
        }
      }
    },
    responses: {
      "200": { description: "Current service snapshot plus drift comparison." },
      "400": { description: "Invalid monitor request." }
    }
  }
};
openapi.paths["/api/managed-monitor-status"] = {
  get: {
    operationId: "managedMonitorStatus",
    tags: ["Managed Monitoring"],
    summary: "Read the latest durable managed-monitor status",
    description:
      "Fetch the latest public status record for an activated managed monitor id. Managed status stores no wallet keys, API credentials, or customer contact information.",
    security: [],
    parameters: [
      { name: "id", in: "query", required: true, schema: { type: "string", pattern: "^mon_[0-9a-f]{20}$" } }
    ],
    responses: {
      "200": { description: "Latest durable managed-monitor record." },
      "404": { description: "Monitor is not active or has not produced its first state record." }
    }
  }
};
openapi.paths["/api/agent-distribution-preview"] = {
  get: {
    operationId: "agentDistributionPreview",
    tags: ["Agent Distribution"],
    summary: "Preview agent-distribution gaps before paying",
    description:
      "Free bounded seller preview. Audits one public API/MCP origin and returns its readiness score plus the top missing machine-readable surfaces. Generated files and the full launch sequence remain in the paid $5 Agent Distribution Pack.",
    security: [],
    parameters: [
      {
        name: "origin",
        in: "query",
        required: true,
        schema: { type: "string", format: "uri" },
        description: "Public API, MCP, x402, or agent-service origin to inspect."
      }
    ],
    responses: {
      "200": { description: "Seller-specific free distribution preview." },
      "400": { description: "Invalid, private, or missing public origin." }
    }
  }
};
openapi.info = {
  ...(openapi.info ?? {}),
  title: "AgentResolver — Managed API/MCP Monitoring + x402 Settlement Canary",
  description:
    "Continuous compatibility monitoring for public API, MCP, x402, and agent services. Use free /api/service-monitor for a live snapshot and drift fingerprint, then /api/managed-monitor-30d ($19 USDC) for 30 days of hourly managed checks with durable status. Agent Distribution remains available for launch work, and payment verification for autonomous buyers remains supporting infrastructure.",
  "x-guidance":
    "Monitoring funnel: start with free GET or POST /api/service-monitor. Supply same-origin mcpEndpoint and/or GET-safe x402Endpoint when relevant. Use POST /api/managed-monitor-30d ($19) for hourly managed monitoring over 30 days. Read current managed state at GET /api/managed-monitor-status?id=<monitorId>. Agent Distribution Pack ($5), Provider Launch Check ($0.05), and free capability discovery remain available as supporting paths. Free constrained procurement remains at POST /api/procure. Supporting buyer paths remain GET /api/x402-ping, GET /api/x402-settlement-verify, and GET /api/x402-payment-preflight before payment. Payment remains caller-authorized."
};
writeJson("public/openapi.json", openapi);
