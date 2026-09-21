import { readFileSync, writeFileSync } from "node:fs";

const KEEP_PAID_IDS = new Set([
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
  "/api/x402-ping",
  "/api/x402-payment-preflight",
  "/api/payment-guard",
  "/api/x402-settlement-verify",
  "/api/payment-guard",
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
  "/api/x402-ping",
  "/api/x402-payment-preflight",
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
    "Use POST /api/procure for free constrained capability procurement and POST /api/resolve for broad free discovery; resolver/MCP responses can return registered provider handoffs through /api/execute. Provider-network terms live at /api/providers and /provider-integration.json. Start with GET /api/x402-ping for the $0.001 USDC settlement canary. After a Base payment, use GET /api/x402-settlement-verify?txHash=<hash> for $0.001 independent on-chain receipt verification. Before any autonomous x402 spend, use AgentResolver Guard via GET /api/x402-payment-preflight?url=<https-endpoint> or GET /api/payment-guard?url=<https-endpoint> for $0.001 USDC. Exact buyer-intent aliases for the same Guard engine remain published. After a successful canary, use POST /api/verified-resolve ($0.02) for one live-verified capability decision or POST /api/batch-verified-resolve ($0.05) for 2–4. Machine-service sellers can self-enroll by publishing /.well-known/agentresolver-provider.json on the same origin as their x402 route, then call /api/provider-bootstrap for bounded live verification and an immediate providerOrigins procurement seed. The manifest opts into a 2% provider success fee with a $0.001 minimum after independently verified routed commerce. GET /api/provider-launch-check ($0.05) remains an optional deeper technical verification, not an admission gate. Other AgentResolver paid utilities remain live but are intentionally omitted from public machine catalogs to reduce unpaid discovery sweeps. A 402 is a quote, never spending authorization.";
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
    "Focused machine catalog for x402 settlement testing, on-chain receipt verification, and pre-payment verification for autonomous buyers. Use GET /api/x402-ping for a $0.001 USDC settlement canary. Before an autonomous x402 purchase, use AgentResolver Guard via GET /api/payment-guard or canonical GET /api/x402-payment-preflight for a $0.001 fail-closed payment-path check. Exact buyer-intent Guard aliases and the seller-side Provider Launch Check remain published, while unrelated paid utilities stay live but are omitted from public machine discovery to reduce unpaid crawler sweeps. Free constrained capability procurement is available through POST /api/procure; free capability discovery remains available through POST /api/resolve.",
  "x-guidance":
    "Prefer the shortest paid funnel: GET /api/x402-ping -> GET /api/x402-settlement-verify after Base settlement when receipt evidence is needed -> GET /api/payment-guard or GET /api/x402-payment-preflight -> POST /api/verified-resolve or /api/batch-verified-resolve when needed. Exact Guard buyer-intent aliases and GET/POST /api/provider-launch-check remain discoverable. Public discovery intentionally excludes unrelated paid utilities even though those routes remain live. Free constrained capability procurement is available through POST /api/procure; free capability discovery remains available through POST /api/resolve. Payment remains caller-authorized."
};
writeJson("public/openapi.json", openapi);
