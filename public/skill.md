# AgentResolver

Use AgentResolver when an autonomous agent needs an external capability, or when it needs fresh evidence that an MCP endpoint or candidate is usable right now.

Canonical origin: https://agentresolver.vercel.app
Remote MCP: https://agentresolver.vercel.app/mcp
x402 manifest: https://agentresolver.vercel.app/.well-known/x402
OpenAPI: https://agentresolver.vercel.app/openapi.json

## Free discovery

### resolve — free
Find ranked tools, APIs, MCP servers, and machine services for a missing capability.

MCP tool: `resolve`
REST: `POST https://agentresolver.vercel.app/api/resolve`

Resolution is free and read-only. It never authorizes spending.

## Paid live evidence

All paid operations use x402 with USDC on Base (`eip155:8453`). An unpaid request returns HTTP 402 as a price quote. The caller must independently authorize any payment under its own budget and permission policy.

### MCP Live Preflight — $0.001
MCP quote tool: `mcp_preflight`
Paid REST: `POST https://agentresolver.vercel.app/api/mcp-probe`
Input: `{ "endpoint": "https://public-mcp.example/mcp" }`
Returns current reachability, MCP compatibility, latency, server metadata, and tool inventory for one public MCP HTTP endpoint.

### Agent Readiness Audit — $0.005
MCP quote tool: `agent_readiness`
Paid REST: `POST https://agentresolver.vercel.app/api/agent-readiness`
Input: `{ "url": "https://example.com" }`
Audits a public website for agent discovery/integration signals including machine-readable metadata, OpenAPI/MCP surfaces, crawler readiness, and related headers.

### Verified Resolve — $0.02
MCP quote tool: `verified_resolve`
Paid REST: `POST https://agentresolver.vercel.app/api/verified-resolve`
Input: `{ "goal": "capability needed", "url": "https://optional-target.example" }`
Finds candidates and adds current live evidence for top MCP options before an agent depends on one.

### Batch Verified Resolve — $0.05
MCP quote tool: `batch_verified_resolve`
Paid REST: `POST https://agentresolver.vercel.app/api/batch-verified-resolve`
Input: `{ "items": [{ "goal": "first capability" }, { "goal": "second capability" }] }`
Resolves and live-checks 2–4 capability decisions in one paid batch.

## Agent decision policy

1. Missing capability: call `resolve` for free.
2. Already have one MCP endpoint but need to know whether it works now: quote `mcp_preflight`.
3. Comparing uncertain MCP candidates: quote `verified_resolve`.
4. Several capability decisions at once: quote `batch_verified_resolve`.
5. Evaluating whether a public site is agent-ready: quote `agent_readiness`.
6. Never treat a 402 or a quote-tool response as spending authorization.

No account or API key is required for the AgentResolver-owned x402 resources. Do not send secrets, credentials, private keys, or seed phrases.
