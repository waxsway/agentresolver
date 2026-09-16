import { NextResponse } from "next/server";
import { sponsorshipInventory } from "@/lib/sponsorship";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const baseUrl = new URL(req.url).origin;
  return NextResponse.json({
    service: "AgentResolver",
    product: "Sponsored capability discovery",
    principle: "Sponsored placement is labeled and never changes organic ranking.",
    inventory: sponsorshipInventory(baseUrl),
    activation: {
      automatic: false,
      operatorApprovalRequired: true,
      contact: {
        type: "github",
        url: "https://github.com/waxsway/agentresolver/issues/new?template=sponsorship.yml",
        suggestedTitle: "AgentResolver sponsorship pilot"
      }
    },
    acceptedCampaignConfig: {
      name: "Provider or product name",
      url: "HTTPS destination",
      description: "Optional short machine-readable description",
      categories: ["web", "documents", "search", "code", "data", "commerce", "payments", "crypto-risk", "communications", "media", "all"]
    }
  }, {
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}
