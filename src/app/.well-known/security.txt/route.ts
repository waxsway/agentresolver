import { NextResponse } from "next/server";

export const dynamic = "force-static";

const BODY = [
  "Contact: https://github.com/waxsway/agentresolver/security/advisories/new",
  "Expires: 2027-03-16T00:00:00Z",
  "Canonical: https://agentresolver.vercel.app/.well-known/security.txt",
  "Policy: https://github.com/waxsway/agentresolver/security/policy",
  "Preferred-Languages: en",
  ""
].join("\n");

export function GET() {
  return new NextResponse(BODY, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400"
    }
  });
}
