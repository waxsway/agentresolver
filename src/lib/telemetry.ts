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

export function logPaidCapabilityAttempt(req: Request, capabilityId: string) {
  const hasPaymentSignature = Boolean(req.headers.get("payment-signature"));
  console.log(JSON.stringify({
    event: "paid_capability_attempt",
    at: new Date().toISOString(),
    capabilityId,
    callerHash: callerHash(req),
    userAgent: safeUserAgent(req),
    referrerHost: referrerHost(req),
    hasPaymentSignature,
    phase: hasPaymentSignature ? "paid_retry" : "challenge_request"
  }));
}
