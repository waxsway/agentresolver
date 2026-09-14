import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      serverInfo: {
        name: "AgentResolver",
        version: "0.1.0"
      },
      authentication: {
        required: false,
        schemes: []
      },
      tools: [
        {
          name: "resolve",
          description:
            "Free universal capability resolver for external tools, APIs, MCP servers, and x402 services.",
          inputSchema: {
            type: "object",
            properties: {
              goal: {
                type: "string",
                description:
                  "Natural-language description of the capability needed."
              },
              url: {
                type: "string",
                format: "uri",
                description: "Optional public URL relevant to the task."
              },
              limit: {
                type: "integer",
                minimum: 1,
                maximum: 10,
                default: 3
              }
            },
            required: ["goal"]
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
          }
        },
        {
          name: "list_capabilities",
          description:
            "List AgentResolver-owned capabilities and their current status.",
          inputSchema: {
            type: "object",
            properties: {}
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
          }
        }
      ],
      resources: [],
      prompts: []
    },
    {
      headers: {
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*"
      }
    }
  );
}
