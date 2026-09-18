import { readFileSync, writeFileSync } from "node:fs";

const KEEP_PAID_IDS = new Set([
  "x402-ping",
  "x402-payment-preflight",
  "x402-settlement-verify",
  "verified-resolve",
  "batch-verified-resolve",
  "provider-attribution-settle"
]);

const KEEP_INTENT_ALIAS_IDS = new Set([
  "usdc-payment-check",
  "x402-preflight",
  "prepayment-authorization-gate",
  "api-trust-security-preflight",
  "x402-transaction-path-payment-gate"
]);

const KEEP_OPENAPI_PATHS = new Set([
  "/api/resolve",
  "/api/health",
  "/api/x402-ping",
  "/api/x402-payment-preflight",
  "/api/x402-settlement-verify",
  "/api/payment-guard",
  "/api/verified-resolve",
  "/api/batch-verified-resolve",
  "/api/provider-attribution-settle",
  "/api/providers",
  "/api/execute",
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
  "/api/provider-attribution-settle",
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
  manifest.instructions =
    "Use POST /api/resolve for free discovery and /api/execute for registered provider handoffs with attribution. Registered providers can settle the fixed $0.001 success fee through POST /api/provider-attribution-settle. Start with GET /api/x402-ping for the $0.001 USDC settlement canary. After a Base payment, use GET /api/x402-settlement-verify?txHash=<hash> for $0.001 independent on-chain receipt verification. Before any autonomous x402 spend, use AgentResolver Guard via GET /api/x402-payment-preflight?url=<https-endpoint> or GET /api/payment-guard?url=<https-endpoint> for $0.001 USDC. Exact buyer-intent aliases for the same Guard engine remain published. After a successful canary, use POST /api/verified-resolve ($0.02) for one live-verified capability decision or POST /api/batch-verified-resolve ($0.05) for 2–4. Other AgentResolver paid utilities remain live but are intentionally omitted from public machine catalogs to reduce unpaid discovery sweeps. A 402 is a quote, never spending authorization.";
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
  registry: "https://agentresolver.vercel.app/api/providers",
  execute: "https://agentresolver.vercel.app/api/execute",
  contract: "https://agentresolver.vercel.app/provider-integration.json",
  attributionHeader: "x-agentresolver-attribution-id",
  arbitraryProxying: false,
  callerSpendingAuthorized: false,
  providerFundedPilot: {
    feeUsd: 0.001,
    settlement: "https://agentresolver.vercel.app/api/provider-attribution-settle"
  }
};
writeJson("public/integrations.json", integrations);

const openapi = readJson("public/openapi.json");
openapi.paths = Object.fromEntries(
  Object.entries(openapi.paths ?? {}).filter(([path]) => KEEP_OPENAPI_PATHS.has(path))
);
openapi.paths["/api/providers"] = {
  get: {
    operationId: "getProviderNetwork",
    tags: ["Agent Tool Discovery"],
    summary: "List registered AgentResolver provider routes and provider-funded pilot terms",
    security: [],
    responses: { "200": { description: "Registered provider network snapshot." } }
  }
};
openapi.paths["/api/execute"] = {
  post: {
    operationId: "routeRegisteredProvider",
    tags: ["Agent Tool Discovery"],
    summary: "Return an execution-ready handoff for a registered provider route",
    description: "Creates an attribution ID and a direct registered-provider handoff. AgentResolver does not proxy the target request or authorize target spend.",
    security: [],
    requestBody: {
      required: true,
      content: { "application/json": { schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          routeId: { type: "string" },
          capabilityId: { type: "string" },
          input: {},
          attributionId: { type: "string" }
        }
      } } }
    },
    responses: {
      "200": { description: "Registered provider handoff and attribution receipt." },
      "404": { description: "No registered provider route matched." }
    }
  }
};
openapi.info = {
  ...(openapi.info ?? {}),
  description:
    "Focused machine catalog for registered provider routing, provider-funded attribution settlement, x402 settlement testing, on-chain receipt verification, and pre-payment verification for autonomous buyers. Use GET /api/x402-ping for a $0.001 USDC settlement canary. Before an autonomous x402 purchase, use AgentResolver Guard via GET /api/payment-guard or canonical GET /api/x402-payment-preflight for a $0.001 fail-closed payment-path check. Exact buyer-intent Guard aliases remain published, while unrelated paid utilities stay live but are omitted from public machine discovery to reduce unpaid crawler sweeps. Free capability discovery remains available through POST /api/resolve.",
  "x-guidance":
    "For a missing capability, use POST /api/resolve -> POST /api/execute to obtain a registered provider handoff and attribution ID. Provider partners can settle $0.001 attribution fees through POST /api/provider-attribution-settle. For AgentResolver-owned paid tools, prefer the shortest paid funnel: GET /api/x402-ping -> GET /api/x402-settlement-verify after Base settlement when receipt evidence is needed -> GET /api/payment-guard or GET /api/x402-payment-preflight -> POST /api/verified-resolve or /api/batch-verified-resolve when needed. Exact Guard buyer-intent aliases remain discoverable. Public discovery intentionally excludes unrelated paid utilities even though those routes remain live. Free capability discovery remains available through POST /api/resolve. Payment remains caller-authorized."
};
writeJson("public/openapi.json", openapi);
