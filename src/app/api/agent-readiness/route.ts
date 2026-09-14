import { NextResponse } from "next/server";
import { auditAgentReadiness } from "@/lib/agentReadiness";

export const dynamic = "force-dynamic";

const MAX_INPUT = 500;

export async function POST(req: Request) {
  if (process.env.AGENT_READINESS_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: "CAPABILITY_NOT_LIVE",
        capabilityId: "agent-readiness",
        message:
          "Agent Readiness Audit is staged but disabled until payment verification and cost controls are approved."
      },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { target?: unknown }
    | null;

  const target = String(body?.target || "").trim();

  if (!target) {
    return NextResponse.json(
      { error: "MISSING_TARGET", message: "Provide a public domain or URL." },
      { status: 400 }
    );
  }

  if (target.length > MAX_INPUT) {
    return NextResponse.json(
      { error: "TARGET_TOO_LONG", message: "Target must be 500 characters or fewer." },
      { status: 400 }
    );
  }

  try {
    const report = await auditAgentReadiness(target);
    return NextResponse.json(report, {
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_TARGET",
        message: error instanceof Error ? error.message : "Invalid target."
      },
      { status: 400 }
    );
  }
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
