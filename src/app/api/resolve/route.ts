import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { resolveGoal } from "@/lib/resolver";

export const dynamic = "force-dynamic";

const MAX_GOAL_LENGTH = 1000;
const MAX_URL_LENGTH = 2048;

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function classifyIntent(goal: string): string[] {
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

function referrerHost(req: Request): string | null {
  const raw = req.headers.get("referer");
  if (!raw) return null;

  try {
    return new URL(raw).hostname.slice(0, 120);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { goal?: unknown; url?: unknown; limit?: unknown }
    | null;

  const goal = String(body?.goal || "").trim();
  const url = typeof body?.url === "string" ? body.url.trim() : undefined;
  const parsedLimit = Number(body?.limit || 3);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, 10))
    : 3;

  if (!goal) {
    return NextResponse.json(
      { error: "MISSING_GOAL", message: "Provide a natural-language goal." },
      { status: 400 }
    );
  }

  if (goal.length > MAX_GOAL_LENGTH) {
    return NextResponse.json(
      {
        error: "GOAL_TOO_LONG",
        message: `Goal must be ${MAX_GOAL_LENGTH} characters or fewer.`
      },
      { status: 400 }
    );
  }

  if (url && url.length > MAX_URL_LENGTH) {
    return NextResponse.json(
      {
        error: "URL_TOO_LONG",
        message: `URL must be ${MAX_URL_LENGTH} characters or fewer.`
      },
      { status: 400 }
    );
  }

  const requestId = randomUUID();
  const resolution = await resolveGoal(goal, url, limit);
  const baseUrl = (
    process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  ).replace(/\/$/, "");

  const ip =
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  console.log(
    JSON.stringify({
      event: "resolver_call",
      requestId,
      at: new Date().toISOString(),
      callerHash: shortHash(ip),
      userAgent: (req.headers.get("user-agent") || "unknown").slice(0, 160),
      referrerHost: referrerHost(req),
      goalHash: shortHash(goal),
      goalLength: goal.length,
      intentTags: classifyIntent(goal),
      hasUrl: Boolean(url),
      topOwnedCapability: resolution.owned[0]?.id || null,
      mcpMatchCount: resolution.mcp.length,
      marketplaceMatchCount: resolution.marketplace.length
    })
  );

  const owned = resolution.owned.map((match) => ({
    ...match,
    execute:
      match.priceUsd > 0
        ? `${baseUrl}/api/execute`
        : match.endpoint
          ? `${baseUrl}${match.endpoint}`
          : null
  }));

  return NextResponse.json(
    {
      requestId,
      resolver: "AgentResolver",
      goal,
      url: url || null,
      free: true,
      owned,
      mcp: resolution.mcp,
      marketplace: resolution.marketplace,
      next:
        resolution.marketplace.length > 0
          ? "Review marketplace payment requirements and input schema before calling a provider. Only pay under the calling agent's own authorization and budget policy."
          : resolution.mcp.length > 0
            ? "Review the MCP server metadata and connect only if it fits the calling agent's trust and authorization policy."
            : owned[0]
              ? `Use capability '${owned[0].id}' if it fits. Paid AgentResolver execution is only attempted when explicitly requested.`
              : "No suitable live marketplace, MCP server, or owned capability was found."
    },
    {
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, payment-signature"
    }
  });
}
