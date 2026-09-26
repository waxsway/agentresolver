import { readFileSync, writeFileSync } from "node:fs";

const KEEP_PAID_IDS = new Set([
  "agent-distribution-pack",
  "x402-ping",
  "x402-payment-preflight",
  "x402-settlement-verify",
  "verified-resolve",
  "batch-verified-resolve",
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
  "/api/agent-distribution-pack",
  "/api/x402-ping",
  "/api/x402-payment-preflight",
  "/api/payment-guard",
  "/api/x402-settlement-verify",
  "/api/verified-resolve",
  "/api/batch-verified-resolve",
  "/api/provider-launch-check",
  "/api/usdc-payment-check",
  "/api/x402-preflight",
  "/api/prepayment-authorization-gate",
  "/api/api-trust-security-preflight",
  "/api/x402-transaction-path-payment-gate"
]);

const KEEP_RESOURCE_PATHS = new Set([
  "/api/agent-distribution-pack",
  "/api/x402-ping",
  "/api/x402-payment-preflight",
  "/api/payment-guard",
  "/api/x402-settlement-verify",
  "/api/verified-resolve",
  "/api/batch-verified-resolve",
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
  manifest.freeDiscovery = {
    ...(manifest.freeDiscovery ?? {}),
    mcp: "https://agentresolver.vercel.app/mcp",
    procure: "https://agentresolver.vercel.app/api/procure",
    resolve: "https://agentresolver.vercel.app/api/resolve"
  };
  manifest.instructions =
    "Primary seller workflow: API, MCP, x402 and agent-service providers should call POST /api/agent-distribution-pack for the $5 Agent Distribution Pack, publish the returned machine-readable launch artifacts, then use GET or POST /api/provider-launch-check ($0.05) for deeper live route verification. Provider-network terms live at /api/providers and /provider-integration.json. Free capability discovery remains available through POST /api/procure and POST /api/resolve. Supporting buyer infrastructure remains public: GET /api/x402-ping is the $0.001 USDC settlement canary; after a Base payment use GET /api/x402-settlement-verify?txHash=<hash> for receipt evidence; before autonomous x402 spend use GET /api/x402-payment-preflight?url=<https-endpoint> or /api/payment-guard for $0.001 payment verification. POST /api/verified-resolve ($0.02) and POST /api/batch-verified-resolve ($0.05) remain available for live-verified buyer decisions. Other AgentResolver paid utilities remain live but are intentionally omitted from public machine catalogs to reduce unpaid discovery sweeps. A 402 is a quote, never spending authorization.";
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
  description:
    "Focused seller-first machine catalog for Agent Distribution. API, MCP, x402 and agent-service providers can purchase POST /api/agent-distribution-pack for a $5 launch audit plus machine-readable distribution artifacts, then use /api/provider-launch-check for live route verification. Supporting x402 settlement, receipt and payment verification remain public for autonomous buyers. Unrelated paid utilities stay live but are omitted from public machine discovery to reduce unpaid crawler sweeps. Free constrained capability procurement is available through POST /api/procure; free capability discovery remains available through POST /api/resolve.",
  "x-guidance":
    "Primary seller funnel: POST /api/agent-distribution-pack ($5) -> publish returned discovery artifacts -> GET or POST /api/provider-launch-check ($0.05). Supporting buyer funnel remains GET /api/x402-ping -> GET /api/x402-settlement-verify when receipt evidence is needed -> GET /api/payment-guard or GET /api/x402-payment-preflight -> POST /api/verified-resolve or /api/batch-verified-resolve when needed. Public discovery intentionally excludes unrelated paid utilities even though those routes remain live. Free constrained capability procurement is available through POST /api/procure; free capability discovery remains available through POST /api/resolve. Payment remains caller-authorized."
};
writeJson("public/openapi.json", openapi);
