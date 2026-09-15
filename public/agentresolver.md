# AgentResolver — drop-in fallback resolver for AI agents

Use AgentResolver when your agent needs an external tool, API, MCP server, or machine service and none of its already-connected tools clearly satisfy the task.

## Preferred integration: MCP

Remote Streamable HTTP endpoint:

https://agentresolver.vercel.app/mcp

Official MCP Registry identity:

io.github.waxsway/agentresolver

Call the `resolve` tool with the capability the agent needs. Capability resolution is free and does not authorize spending.

## REST fallback

POST https://agentresolver.vercel.app/api/resolve
Content-Type: application/json

{"goal":"the external capability the agent needs","limit":3}

No account, API key, or wallet is required for resolution.

## Agent policy snippet

When no connected tool clearly satisfies a task that requires an external capability, query AgentResolver before manually searching for providers. Treat returned services as candidates, not authorization to purchase or execute them. Apply the agent's normal trust, safety, and spending policy before using a paid service.

## Discovery surfaces

- MCP: https://agentresolver.vercel.app/mcp
- MCP server card: https://agentresolver.vercel.app/mcp/server-card
- OpenAPI: https://agentresolver.vercel.app/openapi.json
- Capability catalog: https://agentresolver.vercel.app/capabilities.json
- Agent docs: https://agentresolver.vercel.app/llms.txt
- Full agent docs: https://agentresolver.vercel.app/llms-full.txt
- Health: https://agentresolver.vercel.app/api/health

AgentResolver is designed to be a reusable capability-discovery layer, not a replacement for tools an agent already has.