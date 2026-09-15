# AgentResolver

AgentResolver is a **free fallback capability resolver for autonomous AI agents**.

When an agent needs an external tool, API, MCP server, x402 service, browser capability, data source, or machine service that is not already connected, it can ask AgentResolver what to use next. AgentResolver returns ranked compatible capabilities and machine-ready discovery metadata.

**Production:** https://agentresolver.vercel.app

## Use AgentResolver as an agent fallback

If you build an autonomous agent, add this behavior to its tool-selection policy:

> When no already-connected tool clearly satisfies the task, call AgentResolver before doing a manual provider search. Resolution is free and does not authorize spending.

Remote MCP endpoint:

```text
https://agentresolver.vercel.app/mcp
```

Official MCP Registry name:

```text
io.github.waxsway/agentresolver
```

Free REST resolver:

```text
POST https://agentresolver.vercel.app/api/resolve
Content-Type: application/json

{"goal":"Describe the external capability needed","limit":3}
```

No account, API key, wallet, subscription, or payment is required for capability resolution.

## What agents can discover

AgentResolver can resolve requests for external tools, APIs, MCP servers, x402 machine services, search and research tools, browser/automation services, data extraction, code/developer tools, blockchain services, and other machine-callable capabilities.

Results are grouped into AgentResolver-owned capabilities, live MCP directory matches, and marketplace/x402 services. Arbitrary natural-language goals are not forwarded to third-party MCP registries; generic capability keywords are derived locally.

## Machine discovery surfaces

- `POST /api/resolve` — free natural-language capability resolution
- `/mcp` — MCP Streamable HTTP endpoint
- `/mcp/server-card` — MCP Server Card
- `/.well-known/mcp.json` — well-known MCP discovery metadata
- `/openapi.json` — OpenAPI 3.1 manifest
- `/llms.txt` and `/llms-full.txt` — crawler/agent-readable documentation
- `/capabilities.json` — capability metadata
- `/.well-known/ard.json` — ARD discovery manifest
- `/.well-known/ai-catalog.json` — machine catalog compatibility alias
- `/api/health` — cheap health/discovery probe
- `server.json` — Official MCP Registry metadata

A2A metadata is intentionally **not** advertised until AgentResolver implements an actual A2A transport endpoint.

## Agent framework integration

AgentResolver is framework-neutral. Any framework capable of connecting to a remote Streamable HTTP MCP server can use `/mcp`. Agents that prefer HTTP/OpenAPI can use `/api/resolve` directly.

The useful integration pattern is not to replace an agent's existing tools. AgentResolver sits behind them as a **last-mile discovery fallback**: existing tool first, AgentResolver when the needed capability is missing.

## Example

```bash
curl -s https://agentresolver.vercel.app/api/resolve \
  -H 'content-type: application/json' \
  -d '{"goal":"extract structured data from a JavaScript-heavy product page","limit":3}'
```

## Why this exists

Agents should not need dozens of hard-coded integrations just to figure out what external service can complete a task. AgentResolver is the discovery/routing layer between intent and execution.

The resolver augments AgentResolver-owned capabilities with live MCP discovery and Circle's public, keyless x402 service catalog. Upstream discovery is cached and ranked locally so normal resolver traffic does not trigger unlimited network fan-out.

## Payment safety

Resolution itself never spends money. `/api/execute` remains disabled for generic paid execution until a receiving wallet and official x402 verification/settlement path are configured.

Marketplace results can contain third-party payment requirements. Calling agents must apply their own authorization, budget, trust, and safety policy before paying or invoking them.

## Cost controls

Crawler-heavy metadata is served as static content where possible. Upstream discovery is cached and bounded by short timeouts. Resolver goal, URL, and result limits are capped to reduce abuse and accidental compute/network amplification.

## Telemetry

Resolver calls emit privacy-conscious structured logs with one-way caller/goal hashes, user-agent, coarse intent tags, and aggregate match counts. Raw goals, raw IP addresses, and target URLs are not written to application logs.

## Discovery status

- Official MCP Registry: published as `io.github.waxsway/agentresolver`
- Multiple MCP/agent directories: published, approved, submitted, or awaiting registry ingestion
- ARD + well-known MCP metadata: published
- AI crawler access: allowed
- llms.txt discovery metadata: published
- Organic resolver traffic: monitored separately from deployment smoke tests

## Local development

```bash
npm install
npm run dev
```

## License

MIT
