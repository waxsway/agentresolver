# AgentResolver

AgentResolver is machine-first routing infrastructure for autonomous agents.

An agent describes what it needs. AgentResolver returns ranked compatible capabilities, pricing metadata, and an execution path. Resolution is free; paid capabilities can later use x402 without forcing a human subscription model onto machine callers.

**Production:** https://agentresolver.vercel.app

## Connect

Remote MCP endpoint:

```text
https://agentresolver.vercel.app/mcp
```

No account, API key, or wallet is required for the free resolver.

Official MCP Registry name:

```text
io.github.waxsway/agentresolver
```

## Why this exists

Agents should not need dozens of hard-coded integrations just to figure out what external service can complete a task. AgentResolver is the discovery/routing layer between intent and execution.

## Machine surfaces

- `POST /api/resolve` — free natural-language capability resolution
- `POST /api/execute` — execution gateway; paid execution intentionally disabled until wallet/facilitator configuration
- `/mcp` — MCP Streamable HTTP endpoint
- `/mcp/server-card` — MCP Server Card for pre-connection discovery
- `/openapi.json` — static OpenAPI 3.1 manifest
- `/llms.txt` and `/llms-full.txt` — crawler/agent-readable service documentation
- `/capabilities.json` — static AgentResolver capability metadata
- `/.well-known/ard.json` — ARD v1 discovery manifest
- `/.well-known/ai-catalog.json` — compatibility alias
- `server.json` — official MCP Registry metadata

The resolver augments AgentResolver-owned capabilities with Circle's public, keyless x402 service catalog. The Circle catalog is cached and ranked locally by intent so normal resolver traffic does not trigger one upstream lookup per unique user goal.

A2A metadata is intentionally **not** advertised until AgentResolver implements an actual A2A transport endpoint.

## Example

```bash
curl -s https://agentresolver.vercel.app/api/resolve \
  -H 'content-type: application/json' \
  -d '{"goal":"extract structured data from a JavaScript-heavy product page"}'
```

## Local development

```bash
npm install
npm run dev
```

## Payment safety

The current version does **not** fake or bypass x402 verification. `/api/execute` remains disabled for paid AgentResolver capabilities until a receiving wallet and official x402 verification/settlement path are configured.

Marketplace results returned by the free resolver can contain third-party payment requirements. Calling agents must apply their own authorization, budget, trust, and safety policy before paying or invoking them.

## Cost controls

Crawler-heavy metadata is served as static content where possible. Circle discovery is cached before local ranking. Resolver goal and URL lengths are capped to reduce abuse and accidental compute/network amplification.

## Telemetry

Resolver calls emit structured server logs with a one-way hash of the caller IP and goal, user-agent, goal length, coarse intent tags, URL-presence flag, and match counts. Raw goals, raw IP addresses, and target URLs are not written to application logs.

## Discovery status

- Official MCP Registry: published
- ARD manifest: published
- robots.txt Agentmap: published
- llms.txt discovery metadata: published
- Organic resolver traffic: monitored separately from deployment smoke tests

## Current experiment

The launch hypothesis is simple: if agents discover a genuinely useful free resolver, repeated capability resolution can create downstream paid executions. Early measurement focuses on organic machine calls, repeat usage, requested capability categories, and conversion to paid execution—not pageviews.
