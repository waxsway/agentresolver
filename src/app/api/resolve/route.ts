import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { resolveCapabilities } from "@/lib/catalog";

export const dynamic = "force-dynamic";

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { goal?: unknown; url?: unknown; limit?: unknown }
    | null;

  const goal = String(body?.goal || "").trim();
  const url = typeof body?.url === "string" ? body.url.trim() : undefined;
  const parsedLimit = Number(body?.limit || 3);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 3;

  if (!goal) {
    return NextResponse.json(
      { error: "MISSING_GOAL", message: "Provide a natural-language goal." },
      { status: 400 }
    );
  }

  const requestId = randomUUID();
  const matches = resolveCapabilities(`${goal}${url ? ` ${url}` : ""}`, limit);
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
      goalHash: shortHash(goal),
      goalLength: goal.length,
      hasUrl: Boolean(url),
      topCapability: matches[0]?.id || null,
      matchCount: matches.length
    })
  );

  return NextResponse.json(
    {
      requestId,
      resolver: "AgentResolver",
      goal,
      url: url || null,
      free: true,
      matches: matches.map((match) => ({
        ...match,
        execute:
          match.priceUsd > 0
            ? `${baseUrl}/api/execute`
            : match.endpoint
              ? `${baseUrl}${match.endpoint}`
              : null
      })),
      next: matches[0]
        ? `Use capability '${matches[0].id}' if it fits. Paid execution is only attempted when explicitly requested by the calling agent.`
        : "No suitable capability found yet."
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
