import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { CAPABILITIES, resolveCapabilities } from "@/lib/catalog";

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
        "Free universal capability resolver. Describe an external task and receive ranked machine services with price and execution metadata.",
      inputSchema: z.object({
        goal: z.string().min(1),
        url: z.string().url().optional(),
        limit: z.number().int().min(1).max(10).optional()
      })
    },
    async ({ goal, url, limit }) => {
      const matches = resolveCapabilities(`${goal}${url ? ` ${url}` : ""}`, limit || 3);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ goal, url: url || null, matches }, null, 2)
          }
        ],
        structuredContent: { goal, url: url || null, matches }
      };
    }
  );

  server.registerTool(
    "list_capabilities",
    {
      description: "List AgentResolver capabilities and current prices/status.",
      inputSchema: z.object({})
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(CAPABILITIES, null, 2) }],
      structuredContent: { capabilities: CAPABILITIES }
    })
  );

  return server;
});

export async function POST(req: Request) {
  return handler.fetch(req);
}
