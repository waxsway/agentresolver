import { NextResponse } from "next/server";
import { AGENTRESOLVER_TRUST_CONTRACT } from "@/lib/trustContract";

export const dynamic = "force-dynamic";

export function GET() {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || null;
  const deployment = {
    commitSha,
    sourceCommitUrl: commitSha
      ? `https://github.com/waxsway/agentresolver/commit/${commitSha}`
      : null,
    environment: process.env.VERCEL_ENV || null
  };

  return NextResponse.json(
    {
      ...AGENTRESOLVER_TRUST_CONTRACT,
      deployment
    },
    {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
        "access-control-allow-origin": "*"
      }
    }
  );
}
