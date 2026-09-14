import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { CAPABILITIES } from "@/lib/catalog";
import { resolveGoal } from "@/lib/resolver";

const handler = createMcpHandler(() => {
  const server = new McpServer(
    { name: "agentresolver", version: "0.1.0" },
    {
      instructions:
        "Use resolve when you need an external capability and no already-connected tool clearly satisfies the task. Resolution is free. Never purchase a paid capability unless your own spending policy authorizes it."
    }
  );

  server.registerTool(
    "resolve",
    {
      description:
        "Free universal capability resolver. Searches AgentResolver capabilities plus live x402 marketplace services and returns machine-readable price and invocation metadata.",
      inputSchema: z.object({
        goal: z.string().min(1),
        url: z.string().url().optional(),
        limit: z.number().int().min(1).max(10).optional()
      })
    },
    async ({ goal, url, limit }) => {
      const resolution = await resolveGoal(goal, url, limit || 3);
      const output = {
        goal,
        url: url || null,
        owned: resolution.owned,
        marketplace: resolution.marketplace
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2)
          }
        ],
        structuredContent: output
      };
    }
  );

  server.registerTool(
    "list_capabilities",
    {
      description: "List AgentResolver-owned capabilities and current prices/status.",
      inputSchema: z.object({})
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(CAPABILITIES, null, 2)
        }
      ],
      structuredContent: { capabilities: CAPABILITIES }
    })
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
