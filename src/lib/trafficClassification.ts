import { callerHash, safeUserAgent } from "@/lib/telemetry";

export type TrafficClass =
  | "internal_test"
  | "directory_probe"
  | "liveness_crawler"
  | "agent_discovery"
  | "qualified_intent"
  | "paid_retry"
  | "unknown_external";

export type TrafficClassification = {
  trafficClass: TrafficClass;
  external: boolean;
  sponsorEligible: boolean;
  reason: string;
};

const INTERNAL_UA = [
  "agentresolver-direct-paid-mcp-smoke",
  "agentresolver-production-smoke"
];

const DIRECTORY_UA = [
  "x402scan",
  "agent402",
  "market402",
  "402index",
  "x402dash",
  "rokmcp",
  "pulsefeed"
];

const LIVENESS_UA = [
  "sentineloracle",
  "mcpbeat",
  "catalog-health",
  "mcp-checker",
  "liveness",
  "health-check",
  "healthcheck",
  "uptime"
];

const DISCOVERY_METHODS = new Set([
  "initialize",
  "tools/list",
  "server/discover",
  "notifications/initialized"
]);

export function classifyTraffic(
  req: Request,
  context: {
    path?: string;
    mcpMethod?: string | null;
    tool?: string | null;
    hasUserIntent?: boolean;
    hasPayment?: boolean;
  } = {}
): TrafficClassification {
  const ua = safeUserAgent(req).toLowerCase();
  const path = context.path || (() => {
    try { return new URL(req.url).pathname; } catch { return ""; }
  })();

  if (context.hasPayment || req.headers.get("payment-signature")) {
    return { trafficClass: "paid_retry", external: true, sponsorEligible: false, reason: "payment_signature_present" };
  }

  if (req.headers.get("x-agentresolver-internal") === "1" || INTERNAL_UA.some((token) => ua.includes(token))) {
    return { trafficClass: "internal_test", external: false, sponsorEligible: false, reason: "marked_internal" };
  }

  if (DIRECTORY_UA.some((token) => ua.includes(token))) {
    return { trafficClass: "directory_probe", external: true, sponsorEligible: false, reason: "known_directory_user_agent" };
  }

  if (LIVENESS_UA.some((token) => ua.includes(token))) {
    return { trafficClass: "liveness_crawler", external: true, sponsorEligible: false, reason: "known_liveness_user_agent" };
  }

  if (
    (context.mcpMethod && DISCOVERY_METHODS.has(context.mcpMethod)) ||
    path.startsWith("/.well-known/") ||
    path === "/mcp/server-card" ||
    path === "/capabilities.json" ||
    path === "/openapi.json" ||
    path === "/llms.txt" ||
    path === "/sitemap.xml" ||
    path === "/docs"
  ) {
    return { trafficClass: "agent_discovery", external: true, sponsorEligible: true, reason: "machine_discovery_surface" };
  }

  if (context.hasUserIntent || (context.mcpMethod === "tools/call" && Boolean(context.tool))) {
    return { trafficClass: "qualified_intent", external: true, sponsorEligible: true, reason: "explicit_goal_or_tool_call" };
  }

  return { trafficClass: "unknown_external", external: true, sponsorEligible: true, reason: "unclassified_external_request" };
}

export function trafficLogFields(req: Request, classification: TrafficClassification) {
  return {
    callerHash: callerHash(req),
    userAgent: safeUserAgent(req),
    trafficClass: classification.trafficClass,
    external: classification.external,
    sponsorEligible: classification.sponsorEligible,
    trafficClassReason: classification.reason
  };
}
