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
    const parsed = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as Record<string, unknown>;
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

export function logX402Settlement(response: Response, capabilityId: string, requestId?: string) {
  const receipt = parseX402SettlementHeader(response.headers.get("payment-response"));
  if (!receipt) return;
  const settled = receipt.success && Boolean(receipt.transaction);
  console.log(JSON.stringify({
    event: settled ? "paid_capability_settled" : "paid_capability_settlement_unconfirmed",
    at: new Date().toISOString(),
    capabilityId,
    requestId: requestId || null,
    responseStatus: response.status,
    success: receipt.success,
    network: receipt.network,
    amount: receipt.amount,
    transactionHash: receipt.transaction ? shortHash(receipt.transaction) : null,
    payerHash: receipt.payer ? shortHash(receipt.payer) : null,
    errorReason: receipt.errorReason
  }));
}
