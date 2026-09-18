import { createHash } from "node:crypto";

export function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function classifyIntent(goal: string): string[] {
  const text = goal.toLowerCase();
  const groups: Array<[string, string[]]> = [
    ["web", ["web", "website", "url", "scrape", "crawl", "browser", "page"]],
    ["documents", ["pdf", "document", "invoice", "file", "table", "ocr"]],
    ["search", ["search", "find", "research", "lookup", "discover"]],
    ["code", ["code", "github", "repository", "repo", "compile", "debug"]],
    ["data", ["database", "sql", "data", "csv", "json", "analytics"]],
    ["commerce", ["price", "product", "buy", "purchase", "commerce", "shop"]],
    ["payments", ["pay", "payment", "x402", "usdc", "wallet", "transaction"]],
    ["crypto-risk", ["crypto", "ethereum", "tron", "aml", "compliance", "wallet risk"]],
    ["communications", ["email", "message", "slack", "sms", "notify"]],
    ["media", ["image", "video", "audio", "photo", "transcribe"]]
  ];

  const matched = groups
    .filter(([, terms]) => terms.some((term) => text.includes(term)))
    .map(([name]) => name);

  return matched.length > 0 ? matched.slice(0, 4) : ["other"];
}

export type ConfiguredPaymentRail =
  | "payai"
  | "coinbase-cdp"
  | "payai+circle-gateway"
  | "coinbase-cdp+circle-gateway";

export function configuredPaymentRail(
  capabilityId: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
  network: string | null = null
): ConfiguredPaymentRail {
  const circleEnabled = env.AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED === "1";
  const cdpEnabled = env.AGENTRESOLVER_CDP_FACILITATOR_ENABLED === "1";
  const configuredCapabilities =
    env.AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES?.trim() || "x402-ping";
  const cdpCapabilities = new Set(
    configuredCapabilities.split(",").map((value) => value.trim()).filter(Boolean)
  );
  const cdpEnabledForCapability = cdpEnabled && cdpCapabilities.has(capabilityId);

  if (network?.startsWith("solana:")) return "payai";
  if (cdpEnabledForCapability && circleEnabled) return "coinbase-cdp+circle-gateway";
  if (cdpEnabledForCapability) return "coinbase-cdp";
  if (circleEnabled) return "payai+circle-gateway";
  return "payai";
}

export function callerHash(req: Request): string {
  const ip =
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return shortHash(ip);
}

export function safeUserAgent(req: Request): string {
  return (req.headers.get("user-agent") || "unknown").slice(0, 180);
}

export function referrerHost(req: Request): string | null {
  const raw = req.headers.get("referer");
  if (!raw) return null;
  try {
    return new URL(raw).hostname.slice(0, 120);
  } catch {
    return null;
  }
}

export function logPaidCapabilityAttempt(
  req: Request,
  capabilityId: string,
  traffic?: {
    trafficClass: string;
    external: boolean;
    sponsorEligible: boolean;
    reason: string;
  },
  requestId?: string
) {
  const hasPaymentSignature = Boolean(req.headers.get("payment-signature"));
  console.log(JSON.stringify({
    event: "paid_capability_attempt",
    at: new Date().toISOString(),
    capabilityId,
    requestId: requestId || null,
    callerHash: callerHash(req),
    userAgent: safeUserAgent(req),
    referrerHost: referrerHost(req),
    configuredPaymentRail: configuredPaymentRail(capabilityId),
    hasPaymentSignature,
    phase: hasPaymentSignature ? "paid_retry" : "challenge_request",
    ...(traffic ? {
      trafficClass: traffic.trafficClass,
      external: traffic.external,
      sponsorEligible: traffic.sponsorEligible,
      trafficClassReason: traffic.reason
    } : {})
  }));
}

export type X402SettlementReceipt = {
  success: boolean;
  transaction: string | null;
  network: string | null;
  payer: string | null;
  amount: string | null;
  errorReason: string | null;
};

export function parseX402SettlementHeader(value: string | null): X402SettlementReceipt | null {
  if (!value) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      success: parsed.success === true,
      transaction: typeof parsed.transaction === "string" && parsed.transaction ? parsed.transaction : null,
      network: typeof parsed.network === "string" ? parsed.network.slice(0, 80) : null,
      payer: typeof parsed.payer === "string" && parsed.payer ? parsed.payer : null,
      amount: typeof parsed.amount === "string" ? parsed.amount.slice(0, 80) : null,
      errorReason: typeof parsed.errorReason === "string" ? parsed.errorReason.slice(0, 160) : null
    };
  } catch {
    return null;
  }
}

const PAYMENT_FAILURE_REASON_KEYS = [
  "invalidReason",
  "errorReason",
  "rejectedReason",
  "reason",
  "code",
  "errorType"
] as const;

function boundedFailureReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 160) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:/ -]*$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Extract only an allowlisted, bounded reason token/message from a failed x402
 * response. Never returns the payment signature, payer, transaction, arbitrary
 * response fields, or raw response body.
 */
export function paymentFailureReasonFromJson(value: unknown, depth = 0): string | null {
  if (depth > 3 || !value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 8)) {
      const nested = paymentFailureReasonFromJson(item, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of PAYMENT_FAILURE_REASON_KEYS) {
    const reason = boundedFailureReason(record[key]);
    if (reason) return reason;
  }

  for (const nested of Object.values(record).slice(0, 20)) {
    const reason = paymentFailureReasonFromJson(nested, depth + 1);
    if (reason) return reason;
  }
  return null;
}

export async function extractX402FailureReason(response: Response): Promise<{
  reason: string | null;
  source: "payment_response" | "response_body" | null;
}> {
  const receipt = parseX402SettlementHeader(response.headers.get("payment-response"));
  if (receipt?.errorReason) {
    return { reason: boundedFailureReason(receipt.errorReason), source: "payment_response" };
  }

  try {
    const body = await response.clone().json() as unknown;
    const reason = paymentFailureReasonFromJson(body);
    return reason
      ? { reason, source: "response_body" }
      : { reason: null, source: null };
  } catch {
    return { reason: null, source: null };
  }
}

export async function logPaidRetryRejection(
  req: Request,
  response: Response,
  capabilityId: string,
  requestId?: string,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  if (!req.headers.get("payment-signature") || response.status < 400) return;
  const failure = await extractX402FailureReason(response);
  const receipt = parseX402SettlementHeader(response.headers.get("payment-response"));
  console.log(JSON.stringify({
    event: "paid_capability_paid_retry_rejected",
    at: new Date().toISOString(),
    capabilityId,
    requestId: requestId || null,
    configuredPaymentRail: configuredPaymentRail(capabilityId, env, receipt?.network ?? null),
    responseStatus: response.status,
    reason: failure.reason,
    reasonSource: failure.source
  }));
}

export function logX402Settlement(
  response: Response,
  capabilityId: string,
  requestId?: string,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const receipt = parseX402SettlementHeader(response.headers.get("payment-response"));
  if (!receipt) return;
  const settled = receipt.success && Boolean(receipt.transaction);
  console.log(JSON.stringify({
    event: settled ? "paid_capability_settled" : "paid_capability_settlement_unconfirmed",
    at: new Date().toISOString(),
    capabilityId,
    requestId: requestId || null,
    configuredPaymentRail: configuredPaymentRail(capabilityId, env, receipt.network),
    responseStatus: response.status,
    success: receipt.success,
    network: receipt.network,
    amount: receipt.amount,
    transactionFingerprint: receipt.transaction ? shortHash(receipt.transaction) : null,
    transactionHash: receipt.transaction ? shortHash(receipt.transaction) : null,
    transactionReference: settled && receipt.transaction ? receipt.transaction.slice(0, 200) : null,
    payerHash: receipt.payer ? shortHash(receipt.payer) : null,
    errorReason: receipt.errorReason,
    executionId: response.headers.get("x-agentresolver-execution-id"),
    responseSha256: response.headers.get("x-agentresolver-response-sha256"),
    deploymentCommitSha: response.headers.get("x-agentresolver-deployment")
  }));
}
