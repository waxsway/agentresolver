import { NextResponse } from "next/server";
import type {
  JsonSchema,
  ProcurementConstraints
} from "@/lib/procurement";
import { procureCapability } from "@/lib/procureCapability";
import { normalizeProviderSeedOrigins } from "@/lib/providerBootstrap";
import { classifyIntent } from "@/lib/telemetry";
import { classifyTraffic, trafficLogFields } from "@/lib/trafficClassification";

export const dynamic = "force-dynamic";

const MAX_GOAL_LENGTH = 1000;
const MAX_SCHEMA_BYTES = 50_000;

function schemaOrNull(value: unknown): JsonSchema | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (JSON.stringify(value).length > MAX_SCHEMA_BYTES) return null;
  } catch {
    return null;
  }
  return value as JsonSchema;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        goal?: unknown;
        task?: unknown;
        query?: unknown;
        q?: unknown;
        limit?: unknown;
        providerOrigins?: unknown;
        constraints?: {
          maxPriceUsd?: unknown;
          preferredNetworks?: unknown;
          protocol?: unknown;
          requireHttps?: unknown;
          availableInputSchema?: unknown;
          requiredOutputSchema?: unknown;
          sideEffect?: unknown;
          auth?: unknown;
        };
      }
    | null;

  const goal = String(
    body?.goal ?? body?.task ?? body?.query ?? body?.q ?? ""
  ).trim();
  if (!goal) {
    return NextResponse.json(
      { error: "MISSING_GOAL", message: "Provide the capability the agent needs." },
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

  const parsedLimit = Number(body?.limit ?? 5);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(Math.floor(parsedLimit), 20))
    : 5;

  let providerOrigins: string[] = [];
  if (body?.providerOrigins !== undefined) {
    if (
      !Array.isArray(body.providerOrigins) ||
      !body.providerOrigins.every((value) => typeof value === "string")
    ) {
      return NextResponse.json(
        {
          error: "INVALID_PROVIDER_ORIGINS",
          message: "providerOrigins must be an array of public HTTPS origins."
        },
        { status: 400 }
      );
    }
    try {
      providerOrigins = normalizeProviderSeedOrigins(
        body.providerOrigins as string[]
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: "INVALID_PROVIDER_ORIGINS",
          message:
            error instanceof Error
              ? error.message
              : "providerOrigins is invalid."
        },
        { status: 400 }
      );
    }
  }

  const raw = body?.constraints || {};
  const maxPriceUsd =
    raw.maxPriceUsd === undefined ? undefined : Number(raw.maxPriceUsd);

  if (
    maxPriceUsd !== undefined &&
    (!Number.isFinite(maxPriceUsd) || maxPriceUsd < 0 || maxPriceUsd > 1000)
  ) {
    return NextResponse.json(
      {
        error: "INVALID_MAX_PRICE",
        message: "maxPriceUsd must be between 0 and 1000."
      },
      { status: 400 }
    );
  }

  const preferredNetworks = Array.isArray(raw.preferredNetworks)
    ? raw.preferredNetworks
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 8)
    : undefined;

  const protocol =
    raw.protocol === "x402" || raw.protocol === "l402" || raw.protocol === "mpp" || raw.protocol === "mcp" || raw.protocol === "any"
      ? raw.protocol
      : undefined;

  const sideEffect =
    raw.sideEffect === "read-only" ||
    raw.sideEffect === "state-changing" ||
    raw.sideEffect === "any"
      ? raw.sideEffect
      : undefined;

  const auth =
    raw.auth === "none" ||
    raw.auth === "wallet" ||
    raw.auth === "api-key" ||
    raw.auth === "any"
      ? raw.auth
      : undefined;

  const availableInputSchema =
    raw.availableInputSchema === undefined
      ? undefined
      : schemaOrNull(raw.availableInputSchema);

  const requiredOutputSchema =
    raw.requiredOutputSchema === undefined
      ? undefined
      : schemaOrNull(raw.requiredOutputSchema);

  if (raw.availableInputSchema !== undefined && !availableInputSchema) {
    return NextResponse.json(
      {
        error: "INVALID_INPUT_SCHEMA",
        message:
          "availableInputSchema must be a bounded JSON Schema object."
      },
      { status: 400 }
    );
  }

  if (raw.requiredOutputSchema !== undefined && !requiredOutputSchema) {
    return NextResponse.json(
      {
        error: "INVALID_OUTPUT_SCHEMA",
        message:
          "requiredOutputSchema must be a bounded JSON Schema object."
      },
      { status: 400 }
    );
  }

  const constraints: ProcurementConstraints = {
    ...(maxPriceUsd !== undefined ? { maxPriceUsd } : {}),
    ...(preferredNetworks ? { preferredNetworks } : {}),
    ...(protocol ? { protocol } : {}),
    requireHttps: raw.requireHttps !== false,
    ...(availableInputSchema ? { availableInputSchema } : {}),
    ...(requiredOutputSchema ? { requiredOutputSchema } : {}),
    ...(sideEffect ? { sideEffect } : {}),
    ...(auth ? { auth } : {})
  };

  const baseUrl = (
    process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  ).replace(/\/$/, "");

  const result = await procureCapability(
    goal,
    constraints,
    limit,
    baseUrl,
    { providerOrigins }
  );
  const selected = result.selected;
  const traffic = classifyTraffic(req, {
    path: "/api/procure",
    hasUserIntent: true
  });

  console.log(
    JSON.stringify({
      event: "procurement_call",
      at: new Date().toISOString(),
      ...trafficLogFields(req, traffic),
      intentTags: classifyIntent(goal),
      goalLength: goal.length,
      candidateCount: result.candidateCount,
      returnedCount: result.candidates.length,
      selectedSource: selected?.source || null,
      selectedProtocol: selected?.protocol || null,
      selectedPriceUsd: selected?.priceUsd ?? null,
      selectedStatus: selected?.status || null,
      providerSeedCount: providerOrigins.length,
      unknownConstraintCount: selected?.unknownConstraints.length || 0,
      rejectedCount: result.candidates.filter(
        (candidate) => candidate.status === "rejected"
      ).length
    })
  );

  return NextResponse.json(
    {
      schemaVersion: 1,
      resolver: "AgentResolver",
      mode: "open_world_non_custodial_procurement",
      goal,
      constraints,
      providerOrigins,
      selected,
      candidates: result.candidates,
      verification: result.verification,
      boundaries: {
        accountRequired: false,
        apiKeyRequired: false,
        callerWalletControlledByAgentResolver: false,
        callerSpendAuthorizedByAgentResolver: false,
        arbitraryProxying: false,
        unknownMetadataIsNotTreatedAsVerified: true
      }
    },
    {
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const goal =
    url.searchParams.get("goal") ||
    url.searchParams.get("task") ||
    url.searchParams.get("query") ||
    url.searchParams.get("q") ||
    "";

  const preferredNetworks = [
    ...url.searchParams.getAll("network"),
    ...url.searchParams.getAll("preferredNetwork")
  ].filter(Boolean);

  const providerOrigins = url.searchParams
    .getAll("providerOrigin")
    .filter(Boolean);

  const body = {
    goal,
    ...(providerOrigins.length > 0 ? { providerOrigins } : {}),
    ...(url.searchParams.get("limit")
      ? { limit: url.searchParams.get("limit") }
      : {}),
    constraints: {
      ...(url.searchParams.get("maxPriceUsd")
        ? { maxPriceUsd: url.searchParams.get("maxPriceUsd") }
        : {}),
      ...(url.searchParams.get("protocol")
        ? { protocol: url.searchParams.get("protocol") }
        : {}),
      ...(preferredNetworks.length > 0 ? { preferredNetworks } : {}),
      requireHttps: url.searchParams.get("requireHttps") !== "false"
    }
  };

  const headers = new Headers(req.headers);
  headers.set("content-type", "application/json");

  return POST(new Request(req.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  }));
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}
