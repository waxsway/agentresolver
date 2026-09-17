import { NextResponse } from "next/server";
import { classifyTraffic } from "@/lib/trafficClassification";
import {
  getActiveSponsor,
  logSponsorImpression,
  sponsorPublicPayload,
  sponsorshipInventory
} from "@/lib/sponsorship";

export function GET(req: Request) {
  const baseUrl = new URL(req.url).origin;
  const traffic = classifyTraffic(req, { path: "/mcp/server-card" });
  const sponsor = traffic.sponsorEligible ? getActiveSponsor(["all"]) : null;

  if (sponsor) {
    logSponsorImpression({
      req,
      sponsor,
      placement: "mcp-server-card",
      intentTags: ["all"],
      classification: traffic
    });
  }

  return NextResponse.json({
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: "io.github.waxsway/agentresolver",
    version: "0.1.4",
    title: "AgentResolver Guard — x402 Verify Before Pay",
    description: "GET-first $0.001 USDC x402 verify-before-pay Guard for autonomous agents, plus free fallback capability discovery and machine-readable buyer handoff.",
    websiteUrl: "https://agentresolver.vercel.app",
    repository: { url: "https://github.com/waxsway/agentresolver", source: "github", id: "1370616809" },
    remotes: [{ type: "streamable-http", url: "https://agentresolver.vercel.app/mcp", supportedProtocolVersions: ["2026-07-28"] }],
    sponsored: sponsor ? sponsorPublicPayload(sponsor) : null,
    sponsorship: sponsorshipInventory(baseUrl)
  }, {
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}
