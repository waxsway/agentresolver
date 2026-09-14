export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const body = `# AgentResolver

> Free capability resolution for autonomous AI agents.

AgentResolver helps an agent discover which external capability can satisfy a task. Resolution is free and requires no account, API key, or wallet.

## Machine interfaces

- MCP: ${origin}/mcp
- OpenAPI: ${origin}/openapi.json
- Free resolver: POST ${origin}/api/resolve
- Capability catalog: ${origin}/capabilities.json

## Resolver input

POST /api/resolve
Content-Type: application/json

{"goal":"Describe the external capability needed","url":"https://optional.example"}

Paid execution is optional and must only be attempted under the calling agent's own authorization, budget, and safety policy.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
