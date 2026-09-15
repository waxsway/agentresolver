import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import {
  HTTPFacilitatorClient,
  x402ResourceServer
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension
} from "@x402/extensions/bazaar";
import { auditAgentReadiness } from "@/lib/agentReadiness";
import {
  X402_FACILITATOR_URL,
  X402_NETWORK,
  X402_PAY_TO,
  X402_PRICING
} from "@/lib/x402Config";

export const dynamic = "force-dynamic";

const MAX_INPUT = 500;

type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;
let paidHandler: PaidHandler | null = null;

async function auditHandler(req: NextRequest): Promise<NextResponse<unknown>> {
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
      {
        error: "TARGET_TOO_LONG",
        message: "Target must be 500 characters or fewer."
      },
      { status: 400 }
    );
  }

  try {
    const report = await auditAgentReadiness(target);

    console.log(
      JSON.stringify({
        event: "paid_capability_completed",
        capabilityId: "agent-readiness",
        at: new Date().toISOString(),
        score: report.score,
        grade: report.grade,
        issueCount: report.issues.length
      })
    );

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

function getPaidHandler(): PaidHandler {
  if (paidHandler) return paidHandler;

  const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
  const facilitatorUrl = (
    process.env.X402_FACILITATOR_URL || X402_FACILITATOR_URL
  ).trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
    throw new Error("AGENTRESOLVER_PAY_TO is invalid.");
  }

  if (!/^https:\/\//i.test(facilitatorUrl)) {
    throw new Error("X402_FACILITATOR_URL is invalid.");
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: facilitatorUrl,
    timeoutMs: 10_000
  });

  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(X402_NETWORK, new ExactEvmScheme())
    .registerExtension(bazaarResourceServerExtension);

  paidHandler = withX402<unknown>(
    auditHandler,
    {
      "/api/agent-readiness": {
        accepts: {
          scheme: "exact",
          price: X402_PRICING.agentReadiness,
          network: X402_NETWORK,
          payTo: payTo as `0x${string}`
        },
        description:
          "Audit a public website for AI-agent discoverability and machine-readable integration signals.",
        mimeType: "application/json",
        extensions: {
          ...declareDiscoveryExtension({
            input: {
              target: "https://example.com"
            },
            inputSchema: {
              properties: {
                target: {
                  type: "string",
                  description:
                    "Public HTTP or HTTPS domain/URL to audit for agent readiness."
                }
              },
              required: ["target"]
            },
            bodyType: "json",
            output: {
              example: {
                target: "https://example.com/",
                score: 75,
                grade: "B",
                checks: [],
                issues: [],
                recommendations: []
              }
            }
          })
        }
      }
    },
    resourceServer
  ) as PaidHandler;

  return paidHandler;
}

export async function POST(req: NextRequest) {
  if (process.env.AGENT_READINESS_ENABLED === "false") {
    return NextResponse.json(
      {
        error: "CAPABILITY_NOT_LIVE",
        capabilityId: "agent-readiness",
        message: "Agent Readiness Audit is temporarily disabled."
      },
      { status: 503 }
    );
  }

  try {
    return await getPaidHandler()(req);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "paid_capability_configuration_error",
        capabilityId: "agent-readiness",
        at: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Unknown error"
      })
    );

    return NextResponse.json(
      {
        error: "PAYMENTS_NOT_CONFIGURED",
        message: "Paid execution is temporarily unavailable."
      },
      { status: 503 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers":
        "content-type, payment-signature, payment-required, payment-response"
    }
  });
}
