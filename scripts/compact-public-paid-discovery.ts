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
  manifest.freeDiscovery = {
    ...(manifest.freeDiscovery ?? {}),
    mcp: "https://agentresolver.vercel.app/mcp",
    procure: "https://agentresolver.vercel.app/api/procure",
    resolve: "https://agentresolver.vercel.app/api/resolve"
  };
  manifest.instructions =
    "For API, MCP, and agent-service sellers, use POST /api/agent-distribution-pack ($5 USDC) to audit the live machine-readable surface and receive ready-to-commit discovery artifacts plus a prioritized publication sequence. Then use GET or POST /api/provider-launch-check ($0.05) to verify the live callable/payment contract before AgentResolver provider-network review. Free provider bootstrap remains available at /api/provider-bootstrap. Buyer-side x402 settlement testing, receipt verification, and Guard remain supporting infrastructure through /api/x402-ping, /api/x402-settlement-verify, and /api/x402-payment-preflight. Other AgentResolver paid utilities remain live but are intentionally omitted from public machine catalogs to keep the seller funnel focused. A 402 is a quote, never spending authorization.";
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
    "Seller-side agent distribution for API and MCP providers. The primary paid product is POST /api/agent-distribution-pack ($5 USDC), which audits live machine-readable discovery surfaces and returns ready-to-commit launch artifacts plus a prioritized distribution sequence. GET/POST /api/provider-launch-check ($0.05) verifies the live route and x402 contract as the next seller step. Buyer-side Guard and settlement utilities remain available as supporting infrastructure; unrelated paid utilities stay live but are omitted from public machine discovery to keep the commercial funnel focused.",
  "x-guidance":
    "Seller funnel: POST /api/agent-distribution-pack ($5) -> publish the returned discovery artifacts -> GET or POST /api/provider-launch-check ($0.05) for live verification -> provider bootstrap/review. Buyer-side settlement and Guard routes remain supporting infrastructure. Public discovery intentionally excludes unrelated paid utilities even though those routes remain live. Payment remains caller-authorized."
};
writeJson("public/openapi.json", openapi);
