import { callerHash, shortHash } from "@/lib/telemetry";
import type { TrafficClassification } from "@/lib/trafficClassification";

export type ActiveSponsor = {
  campaignId: string;
  name: string;
  url: string;
  description: string | null;
  categories: string[];
  disclosure: "sponsored";
  organicRankingIndependent: true;
};

function clean(value: string | undefined, max: number) {
  return (value || "").trim().slice(0, max);
}

function safeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getActiveSponsor(intentTags: string[]): ActiveSponsor | null {
  const campaignId = clean(process.env.AGENTRESOLVER_SPONSOR_CAMPAIGN_ID, 80);
  const name = clean(process.env.AGENTRESOLVER_SPONSOR_NAME, 120);
  const rawUrl = clean(process.env.AGENTRESOLVER_SPONSOR_URL, 2048);
  const url = safeHttpsUrl(rawUrl);
  if (!campaignId || !name || !url) return null;

  const categories = clean(process.env.AGENTRESOLVER_SPONSOR_CATEGORIES, 500)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
  const normalized = categories.length > 0 ? categories : ["all"];
  const matches = normalized.includes("all") || intentTags.some((tag) => normalized.includes(tag.toLowerCase()));
  if (!matches) return null;

  return {
    campaignId,
    name,
    url,
    description: clean(process.env.AGENTRESOLVER_SPONSOR_DESCRIPTION, 280) || null,
    categories: normalized,
    disclosure: "sponsored",
    organicRankingIndependent: true
  };
}

export function sponsorshipInventory(baseUrl: string) {
  return {
    model: "provider-funded-discovery",
    status: "pilot_inventory_open",
    organicRankingIndependent: true,
    placements: [
      "resolver-response",
      "mcp-resolve",
      "mcp-server-card"
    ],
    targeting: ["intent-category"],
    reporting: ["eligible-impressions", "qualified-intent-impressions", "attributed-handoffs"],
    providerSuccessFeePilot: {
      status: "open",
      feeUsd: 0.001,
      trigger: "provider-reported fulfilled attribution",
      settlement: `${baseUrl.replace(/\/$/, "")}/api/provider-attribution-settle`,
      organicRankingIndependent: true
    },
    rateCard: "operator-approved pilot",
    details: `${baseUrl.replace(/\/$/, "")}/api/sponsorship`
  };
}

export function sponsorPublicPayload(sponsor: ActiveSponsor) {
  return {
    disclosure: sponsor.disclosure,
    name: sponsor.name,
    url: sponsor.url,
    description: sponsor.description,
    categories: sponsor.categories,
    organicRankingIndependent: sponsor.organicRankingIndependent
  };
}

export function logSponsorImpression(input: {
  req?: Request;
  sponsor: ActiveSponsor;
  placement: string;
  intentTags: string[];
  classification?: TrafficClassification;
  goal?: string;
}) {
  const classification = input.classification;
  console.log(JSON.stringify({
    event: "sponsor_impression",
    at: new Date().toISOString(),
    campaignId: input.sponsor.campaignId,
    campaignHash: shortHash(input.sponsor.campaignId),
    placement: input.placement,
    intentTags: input.intentTags.slice(0, 4),
    trafficClass: classification?.trafficClass || "qualified_intent",
    sponsorEligible: classification?.sponsorEligible ?? true,
    callerHash: input.req ? callerHash(input.req) : null,
    goalHash: input.goal ? shortHash(input.goal) : null
  }));
}
