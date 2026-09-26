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
    title: "AgentResolver — Agent Distribution for APIs & MCP",
    description: "Seller-side agent distribution for API, MCP, x402, and agent-service providers: $5 launch artifacts, live route verification, provider routing, plus supporting verify-before-pay and settlement-receipt verification.",
    websiteUrl: "https://agentresolver.vercel.app",
    repository: { url: "https://github.com/waxsway/agentresolver", source: "github", id: "1370616809" },
    remotes: [{ type: "streamable-http", url: "https://agentresolver.vercel.app/mcp", supportedProtocolVersions: ["2026-07-28"] }],
    sellerDistribution: {
      landingPage: `${baseUrl}/distribution`,
      distributionPack: `${baseUrl}/api/agent-distribution-pack`,
      distributionPackPriceUsd: 5,
      liveLaunchCheck: `${baseUrl}/api/provider-launch-check`,
      liveLaunchCheckPriceUsd: 0.05,
      implementationSprint: `${baseUrl}/mcp-sprint`
    },
    providerNetwork: {
      registry: `${baseUrl}/api/providers`,
      execute: `${baseUrl}/api/execute`,
      attributionHeader: "x-agentresolver-attribution-id",
      providerSettlement: `${baseUrl}/api/provider-attribution-settle`,
      paidProviderLaunchCheck: `${baseUrl}/api/provider-launch-check`,
      providerLaunchCheckPriceUsd: 0.05,
      arbitraryProxying: false,
      callerSpendingAuthorized: false
    },
    sponsored: sponsor ? sponsorPublicPayload(sponsor) : null,
    sponsorship: sponsorshipInventory(baseUrl)
  }, {
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}
