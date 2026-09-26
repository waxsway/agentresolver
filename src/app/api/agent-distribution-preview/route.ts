import { NextRequest, NextResponse } from "next/server";
import { auditAgentReadiness } from "@/lib/agentReadiness";
import { buildAgentDistributionPreview } from "@/lib/agentDistributionPreview";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin")?.trim() || "";

  if (!origin) {
    return NextResponse.json(
      {
        error: "origin is required",
        example:
          "https://agentresolver.vercel.app/api/agent-distribution-preview?origin=https%3A%2F%2Fapi.example.com"
      },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const report = await auditAgentReadiness(origin);
    return NextResponse.json(buildAgentDistributionPreview(report), {
      headers: { "cache-control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to inspect that public origin."
      },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }
}
