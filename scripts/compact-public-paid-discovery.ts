import { readFileSync, writeFileSync } from "node:fs";

const KEEP_PAID_IDS = new Set([
  "x402-ping",
  "x402-payment-preflight",
  "hash-encode",
  "verified-resolve",
  "batch-verified-resolve"
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
  "/api/payment-guard",
  "/api/hash-encode",
  "/api/verified-resolve",
  "/api/batch-verified-resolve",
  "/api/usdc-payment-check",
  "/api/x402-preflight",
  "/api/prepayment-authorization-gate",
  "/api/api-trust-security-preflight",
  "/api/x402-transaction-path-payment-gate"
]);

const KEEP_RESOURCE_PATHS = new Set([
  "/api/x402-ping",
  "/api/x402-payment-preflight",
  "/api/hash-encode",
  "/api/verified-resolve",
  "/api/batch-verified-resolve",
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
    "Start with GET /api/x402-ping for the $0.001 USDC settlement canary, or GET /api/hash-encode?operation=sha256&input=<text> for a useful $0.001 deterministic paid call. Before any autonomous x402 spend, use AgentResolver Guard via GET /api/x402-payment-preflight?url=<https-endpoint> or GET /api/payment-guard?url=<https-endpoint> for $0.001 USDC. Exact buyer-intent aliases for the same Guard engine remain published. After a successful canary, use POST /api/verified-resolve ($0.02) for one live-verified capability decision or POST /api/batch-verified-resolve ($0.05) for 2–4. Other AgentResolver paid utilities remain live but are intentionally omitted from public machine catalogs to reduce unpaid discovery sweeps. A 402 is a quote, never spending authorization.";
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
writeJson("public/integrations.json", integrations);

const openapi = readJson("public/openapi.json");
openapi.paths = Object.fromEntries(
  Object.entries(openapi.paths ?? {}).filter(([path]) => KEEP_OPENAPI_PATHS.has(path))
);
openapi.info = {
  ...(openapi.info ?? {}),
  description:
    "Focused machine catalog for x402 settlement testing, payment verification, and one useful zero-setup paid utility. Use GET /api/x402-ping for a $0.001 USDC settlement canary or GET /api/hash-encode?operation=sha256&input=<text> for a $0.001 deterministic paid call. Before an autonomous x402 purchase, use AgentResolver Guard via GET /api/payment-guard or canonical GET /api/x402-payment-preflight for a $0.001 fail-closed payment-path check. Exact buyer-intent Guard aliases remain published, while unrelated paid utilities stay live but are omitted from public machine discovery to reduce unpaid crawler sweeps. Free capability discovery remains available through POST /api/resolve.",
  "x-guidance":
    "Prefer a $0.001 GET entrypoint: GET /api/x402-ping for settlement testing or GET /api/hash-encode?operation=sha256&input=<text> for useful deterministic work. Before autonomous x402 spend, use GET /api/payment-guard or GET /api/x402-payment-preflight, then POST /api/verified-resolve or /api/batch-verified-resolve when needed. Exact Guard buyer-intent aliases remain discoverable. Public discovery intentionally excludes unrelated paid utilities even though those routes remain live. Free capability discovery remains available through POST /api/resolve. Payment remains caller-authorized."
};
writeJson("public/openapi.json", openapi);
