import { readFileSync, writeFileSync } from "node:fs";

const KEEP_PAID_IDS = new Set([
  "x402-ping",
  "x402-payment-preflight",
  "x402-settlement-verify",
  "verified-resolve",
  "batch-verified-resolve",
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
    "Seller-side agent distribution for API, MCP, x402, and agent-service providers. The $5 Agent Distribution Pack audits live machine-readable launch surfaces and returns ready-to-commit discovery artifacts plus a prioritized publication sequence; buyer-side settlement and verify-before-pay utilities remain supporting infrastructure.";
  manifest.tags = [
    "agent-distribution",
    "api-distribution",
    "mcp-distribution",
    "seller-launch",
    "provider-growth",
    "x402"
  ];
  manifest.freeDiscovery = {
    ...(manifest.freeDiscovery ?? {}),
    mcp: "https://agentresolver.vercel.app/mcp",
    procure: "https://agentresolver.vercel.app/api/procure",
    resolve: "https://agentresolver.vercel.app/api/resolve"
  };
  manifest.instructions =
    "For API, MCP, and agent-service sellers, the primary paid funnel is POST /api/agent-distribution-pack ($5 USDC) for a live discoverability audit, ready-to-commit launch artifacts, and a prioritized publication sequence, followed by GET or POST /api/provider-launch-check ($0.05) for live route/payment-contract verification before provider-network review. Free capability discovery and procurement remain available through POST /api/resolve and POST /api/procure; free provider bootstrap remains at /api/provider-bootstrap. Buyer-side payment verification for autonomous buyers remains supporting infrastructure: GET /api/x402-ping for the settlement canary, GET /api/x402-settlement-verify after Base settlement, and GET /api/x402-payment-preflight before a target x402 purchase; POST remains supported where applicable. POST /api/verified-resolve and POST /api/batch-verified-resolve remain available for paid live-verified buyer decisions. Other paid utilities remain live but are intentionally omitted from public machine catalogs to reduce unpaid crawler sweeps and keep the seller funnel focused. A 402 is a quote, never spending authorization.";
  writeJson(path, manifest);
}

const capabilities = readJson("public/capabilities.json");
capabilities.capabilities = (capabilities.capabilities ?? []).filter((item: any) => {
  const priceUsd = Number(item?.priceUsd ?? 0);
  return priceUsd === 0 || KEEP_PAID_IDS.has(String(item?.id ?? ""));
});
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
openapi.info = {
  ...(openapi.info ?? {}),
  title: "AgentResolver — Agent Distribution + x402 Settlement Canary",
  description:
    "Seller-side agent distribution for API and MCP providers. The primary paid product is POST /api/agent-distribution-pack ($5 USDC), which audits live machine-readable discovery surfaces and returns ready-to-commit launch artifacts plus a prioritized distribution sequence. GET/POST /api/provider-launch-check ($0.05) verifies the live route and x402 contract as the next seller step. Buyer-side payment verification for autonomous buyers remains available as supporting infrastructure through the x402 settlement canary, on-chain receipt verification, and verify-before-pay Guard. Unrelated paid utilities stay live but are omitted from public machine discovery to reduce unpaid crawler sweeps and keep the commercial funnel focused.",
  "x-guidance":
    "Seller funnel: POST /api/agent-distribution-pack ($5) -> publish the returned discovery artifacts -> GET or POST /api/provider-launch-check ($0.05) for live verification -> provider bootstrap/review. Free capability discovery remains available through POST /api/resolve and free constrained procurement through POST /api/procure. Supporting buyer paths remain GET /api/x402-ping, GET /api/x402-settlement-verify, and GET /api/x402-payment-preflight before payment; POST /api/verified-resolve and POST /api/batch-verified-resolve remain available for live-verified decisions. Public discovery intentionally excludes unrelated paid utilities even though those routes remain live. Payment remains caller-authorized."
};
writeJson("public/openapi.json", openapi);
