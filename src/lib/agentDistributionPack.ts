import { auditAgentReadiness } from "@/lib/agentReadiness";

export type AgentDistributionPackInput = {
  providerName: string;
  description: string;
  origin: string;
  primaryEndpoint?: string | null;
  openapiUrl?: string | null;
  mcpName?: string | null;
  mcpEndpoint?: string | null;
  repositoryUrl?: string | null;
  version?: string | null;
  tags?: string[];
};

function requiredText(value: unknown, field: string, max: number) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new Error(field + " is required.");
  if (result.length > max) throw new Error(field + " is too long.");
  return result;
}

function optionalText(value: unknown, max: number) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) return null;
  if (result.length > max) throw new Error("Optional text value is too long.");
  return result;
}

function publicHttps(value: unknown, field: string) {
  const raw = requiredText(value, field, 2048);
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error(field + " must be a public HTTPS URL without credentials or a custom port.");
  }
  url.hash = "";
  return url.toString();
}

function optionalPublicHttps(value: unknown, field: string) {
  const text = optionalText(value, 2048);
  return text ? publicHttps(text, field) : null;
}

function normalizeMcpName(value: unknown) {
  const text = optionalText(value, 160);
  if (!text) return null;
  if (!/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)?$/.test(text)) {
    throw new Error("mcpName must look like a registry name such as io.github.owner/server.");
  }
  return text;
}

export function parseAgentDistributionPackInput(value: unknown): AgentDistributionPackInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Provide a JSON distribution packet.");
  }
  const body = value as Record<string, unknown>;
  const origin = publicHttps(body.origin, "origin");
  const tags = Array.isArray(body.tags)
    ? body.tags
        .map((tag) => typeof tag === "string" ? tag.trim().toLowerCase().slice(0, 60) : "")
        .filter(Boolean)
        .slice(0, 12)
    : [];

  const mcpEndpoint = optionalPublicHttps(body.mcpEndpoint, "mcpEndpoint");
  const primaryEndpoint = optionalPublicHttps(body.primaryEndpoint, "primaryEndpoint");
  const openapiUrl = optionalPublicHttps(body.openapiUrl, "openapiUrl");
  const repositoryUrl = optionalPublicHttps(body.repositoryUrl, "repositoryUrl");

  for (const [field, url] of [
    ["mcpEndpoint", mcpEndpoint],
    ["primaryEndpoint", primaryEndpoint],
    ["openapiUrl", openapiUrl]
  ] as const) {
    if (url && new URL(url).origin !== new URL(origin).origin) {
      throw new Error(field + " must share the declared origin.");
    }
  }

  return {
    providerName: requiredText(body.providerName, "providerName", 120),
    description: requiredText(body.description, "description", 500),
    origin,
    primaryEndpoint,
    openapiUrl,
    mcpName: normalizeMcpName(body.mcpName),
    mcpEndpoint,
    repositoryUrl,
    version: optionalText(body.version, 40) || "0.1.0",
    tags
  };
}

function hostLabel(origin: string) {
  return new URL(origin).hostname.replace(/^www\./, "");
}

function buildLlmsTxt(input: AgentDistributionPackInput) {
  const lines = [
    `# ${input.providerName}`,
    "",
    input.description,
    "",
    `Canonical origin: ${input.origin}`
  ];
  if (input.primaryEndpoint) lines.push(`Primary API: ${input.primaryEndpoint}`);
  if (input.openapiUrl) lines.push(`OpenAPI: ${input.openapiUrl}`);
  if (input.mcpEndpoint) lines.push(`MCP: ${input.mcpEndpoint}`);
  if (input.repositoryUrl) lines.push(`Repository: ${input.repositoryUrl}`);
  if (input.tags?.length) lines.push(`Tags: ${input.tags.join(", ")}`);
  lines.push("", "Use the canonical machine-readable interfaces above instead of guessing undocumented routes.");
  return lines.join("\n");
}

function buildServerJson(input: AgentDistributionPackInput) {
  if (!input.mcpName || !input.mcpEndpoint) return null;
  const value: Record<string, unknown> = {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: input.mcpName,
    title: input.providerName,
    description: input.description.slice(0, 100),
    version: input.version || "0.1.0",
    remotes: [{ type: "streamable-http", url: input.mcpEndpoint }]
  };
  if (input.repositoryUrl) {
    value.repository = { url: input.repositoryUrl, source: "github" };
  }
  return value;
}

function buildRobotsAdditions(input: AgentDistributionPackInput) {
  return [
    "# Agent-readable discovery",
    `Sitemap: ${new URL("/sitemap.xml", input.origin).toString()}`,
    `Agentmap: ${new URL("/.well-known/ard.json", input.origin).toString()}`
  ].join("\n");
}

function targetStatus(input: AgentDistributionPackInput, readinessIds: Set<string>) {
  return [
    {
      target: "Official MCP Registry",
      applicable: Boolean(input.mcpName && input.mcpEndpoint),
      ready: Boolean(input.mcpName && input.mcpEndpoint),
      action: input.mcpName && input.mcpEndpoint
        ? "Publish server.json with the supplied registry name and remote MCP URL."
        : "Supply mcpName + mcpEndpoint only if this product exposes MCP."
    },
    {
      target: "LLM / crawler discovery",
      applicable: true,
      ready: readinessIds.has("llms"),
      action: readinessIds.has("llms")
        ? "Keep /llms.txt current with canonical product and interface URLs."
        : "Publish the generated /llms.txt artifact."
    },
    {
      target: "API tool discovery",
      applicable: Boolean(input.primaryEndpoint || input.openapiUrl),
      ready: readinessIds.has("openapi"),
      action: readinessIds.has("openapi")
        ? "Keep /openapi.json canonical and machine-readable."
        : "Publish a canonical OpenAPI document and link it from /llms.txt."
    },
    {
      target: "MCP host discovery",
      applicable: Boolean(input.mcpEndpoint),
      ready: readinessIds.has("mcp-card"),
      action: readinessIds.has("mcp-card")
        ? "Keep MCP server metadata aligned with the live remote endpoint."
        : "Publish MCP server metadata and the generated registry server.json."
    },
    {
      target: "AgentResolver provider distribution",
      applicable: Boolean(input.primaryEndpoint),
      ready: Boolean(input.primaryEndpoint),
      action: input.primaryEndpoint
        ? "Run the separate Provider Launch Check after the endpoint is live and payment metadata is stable."
        : "Supply a primaryEndpoint when a callable route is ready for distribution."
    }
  ];
}

export async function buildAgentDistributionPack(input: AgentDistributionPackInput) {
  const readiness = await auditAgentReadiness(input.origin);
  const readyIds = new Set(readiness.checks.filter((item) => item.ok).map((item) => item.id));
  const serverJson = buildServerJson(input);
  const missing = readiness.checks.filter((item) => !item.ok).map((item) => item.id);

  const priority = [
    !readyIds.has("llms") ? "Publish /llms.txt from the generated artifact." : null,
    input.mcpEndpoint && !readyIds.has("mcp-card")
      ? "Publish MCP server metadata and submit server.json to the official MCP Registry."
      : null,
    (input.primaryEndpoint || input.openapiUrl) && !readyIds.has("openapi")
      ? "Publish canonical OpenAPI metadata for callable operations."
      : null,
    !readyIds.has("sitemap") ? "Publish /sitemap.xml and include discovery surfaces." : null,
    input.primaryEndpoint
      ? "After the discovery files are live, run AgentResolver Provider Launch Check to verify the callable route before distribution."
      : null
  ].filter((item): item is string => Boolean(item));

  return {
    product: "AgentResolver Agent Distribution Pack",
    paidDeliverable: true,
    provider: {
      name: input.providerName,
      origin: input.origin,
      host: hostLabel(input.origin)
    },
    baseline: readiness,
    diagnosis: {
      missingSurfaceCount: missing.length,
      missingSurfaces: missing,
      primaryBottleneck:
        missing.length === 0
          ? "No baseline discovery surface is missing; focus on registry publication, intent wording, and conversion."
          : `Missing machine-readable discovery surfaces: ${missing.join(", ")}.`
    },
    artifacts: {
      "llms.txt": buildLlmsTxt(input),
      "server.json": serverJson,
      "robots.txt.additions": buildRobotsAdditions(input),
      "mcp-client.json": input.mcpEndpoint
        ? { mcpServers: { [input.providerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "provider"]: { url: input.mcpEndpoint } } }
        : null
    },
    launchSequence: priority,
    distributionTargets: targetStatus(input, readyIds),
    nextPaidProof: input.primaryEndpoint
      ? {
          product: "Provider Launch Check",
          endpoint: "https://agentresolver.vercel.app/api/provider-launch-check",
          priceUsd: 0.05,
          purpose: "Live seller-side readiness and x402 contract verification before AgentResolver provider-network review."
        }
      : null,
    limitations: [
      "This pack improves machine-readable launch readiness; it does not guarantee ranking, traffic, buyer demand, directory acceptance, or revenue.",
      "External registries and platforms control their own inclusion and ranking rules.",
      "Generated artifacts must be reviewed against the provider's actual API, MCP behavior, authentication, and legal requirements before publication."
    ]
  };
}
