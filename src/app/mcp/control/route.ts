import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { resolveGoal } from "@/lib/resolver";
import { resolveProviderRoutes } from "@/lib/providerNetwork";
import { procureCapability } from "@/lib/procureCapability";
import type { ProcurementConstraints } from "@/lib/procurement";
import { classifyIntent, shortHash } from "@/lib/telemetry";

const CANONICAL = "https://agentresolver.vercel.app";

function logToolCall(tool: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    event: "mcp_control_tool_call",
    tool,
    at: new Date().toISOString(),
    ...extra
  }));
}

const handler = createMcpHandler(() => {
  const server = new McpServer(
    { name: "agentresolver-control", version: "0.1.0" },
    {
      instructions:
        "AgentResolver Control is a low-context fallback for autonomous agents. Use procure when hard budget, protocol, network, schema, side-effect, or auth constraints matter. Use resolve for broad discovery. Both tools are free, read-only, non-custodial, and never authorize spending. Execute returned providers directly under the caller's own trust and spend policy."
    }
  );

  server.registerTool(
    "procure",
    {
      title: "Procure a compatible capability",
      description:
        "Find an external API, MCP server, x402 service, or registered provider that satisfies explicit hard constraints. Returns ranked candidates, deterministic rejection reasons, unknown-evidence flags, and a direct non-custodial execution/payment handoff. Free and never authorizes spend.",
      inputSchema: z.object({
        goal: z
          .string()
          .min(1)
          .max(1000)
          .describe("Plain-language description of the external capability the agent needs."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Maximum number of ranked candidates to return. Defaults to 5."),
        constraints: z
          .object({
            maxPriceUsd: z
              .number()
              .min(0)
              .max(1000)
              .optional()
              .describe("Maximum target-provider price in USD that the caller is willing to consider."),
            preferredNetworks: z
              .array(z.string().min(1).max(128))
              .max(8)
              .optional()
              .describe("Allowed or preferred payment networks, for example eip155:8453."),
            protocol: z
              .enum(["x402", "mcp", "any"])
              .optional()
              .describe("Required provider protocol. Use any when protocol is not a hard constraint."),
            requireHttps: z
              .boolean()
              .optional()
              .describe("Require an HTTPS execution endpoint. Defaults to true."),
            availableInputSchema: z
              .record(z.string(), z.unknown())
              .optional()
              .describe("JSON Schema describing the data the caller can provide to the selected capability."),
            requiredOutputSchema: z
              .record(z.string(), z.unknown())
              .optional()
              .describe("JSON Schema describing the output the caller requires from the selected capability."),
            sideEffect: z
              .enum(["read-only", "state-changing", "any"])
              .optional()
              .describe("Allowed side-effect class for the selected capability."),
            auth: z
              .enum(["none", "wallet", "api-key", "any"])
              .optional()
              .describe("Allowed provider authentication model.")
          })
          .optional()
          .describe("Hard procurement constraints. Missing evidence is surfaced as unknown rather than assumed compatible.")
      }),
      annotations: {
        title: "Procure a compatible capability",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ goal, limit, constraints }) => {
      const result = await procureCapability(
        goal,
        (constraints || {}) as ProcurementConstraints,
        limit || 5,
        CANONICAL
      );

      logToolCall("procure", {
        goalHash: shortHash(goal),
        goalLength: goal.length,
        intentTags: classifyIntent(goal),
        candidateCount: result.candidateCount,
        returnedCount: result.candidates.length,
        selectedSource: result.selected?.source || null,
        selectedStatus: result.selected?.status || null
      });

      const output = {
        schemaVersion: 1,
        resolver: "AgentResolver",
        surface: "mcp-control",
        mode: "open_world_non_custodial_procurement",
        goal,
        constraints: constraints || {},
        selected: result.selected,
        candidates: result.candidates,
        verification: result.verification,
        boundaries: {
          free: true,
          readOnly: true,
          accountRequired: false,
          apiKeyRequired: false,
          callerWalletControlledByAgentResolver: false,
          callerSpendAuthorizedByAgentResolver: false,
          arbitraryProxying: false,
          unknownMetadataIsNotTreatedAsVerified: true
        },
        fullCatalog: {
          mcp: `${CANONICAL}/mcp`,
          openapi: `${CANONICAL}/openapi.json`,
          capabilities: `${CANONICAL}/capabilities.json`
        }
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output
      };
    }
  );

  server.registerTool(
    "resolve",
    {
      title: "Resolve a missing capability",
      description:
        "Broad free discovery when the caller does not yet have an exact contract. Returns AgentResolver-owned capabilities, registered provider routes, MCP matches, and marketplace/x402 matches. Use procure instead when hard compatibility or budget constraints must be enforced.",
      inputSchema: z.object({
        goal: z
          .string()
          .min(1)
          .max(1000)
          .describe("Plain-language description of the missing capability."),
        url: z
          .string()
          .url()
          .optional()
          .describe("Optional public URL related to the task when discovery should consider a concrete endpoint or resource."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("Maximum results per discovery source. Defaults to 3.")
      }),
      annotations: {
        title: "Resolve a missing capability",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ goal, url, limit }) => {
      const safeLimit = limit || 3;
      const [resolution, providerRoutes] = await Promise.all([
        resolveGoal(goal, url, safeLimit),
        Promise.resolve(resolveProviderRoutes(goal, Math.min(safeLimit, 5)))
      ]);

      logToolCall("resolve", {
        goalHash: shortHash(goal),
        goalLength: goal.length,
        intentTags: classifyIntent(goal),
        ownedCount: resolution.owned.length,
        providerRouteCount: providerRoutes.length,
        mcpCount: resolution.mcp.length,
        marketplaceCount: resolution.marketplace.length
      });

      const output = {
        schemaVersion: 1,
        resolver: "AgentResolver",
        surface: "mcp-control",
        goal,
        owned: resolution.owned,
        providerRoutes,
        mcp: resolution.mcp,
        marketplace: resolution.marketplace,
        next: {
          useProcureWhen:
            "Call procure when price, network, protocol, input/output schema, side-effect, or auth compatibility is a hard requirement.",
          procureTool: "procure"
        },
        boundaries: {
          free: true,
          readOnly: true,
          spendingAuthorized: false,
          arbitraryProxying: false
        }
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output
      };
    }
  );

  return server;
});

export async function POST(req: Request) {
  return handler.fetch(req);
}

export async function GET(req: Request) {
  return handler.fetch(req);
}

export async function DELETE(req: Request) {
  return handler.fetch(req);
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { "cache-control": "public, max-age=60" }
  });
}
