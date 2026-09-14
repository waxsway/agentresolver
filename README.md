# AgentResolver

AgentResolver is machine-first routing infrastructure for autonomous agents.

An agent describes what it needs. AgentResolver returns ranked compatible capabilities, pricing metadata, and an execution path. Resolution is free; paid capabilities can later use x402 without forcing a human subscription model onto machine callers.

## Why this exists

Agents should not need dozens of hard-coded integrations just to figure out what external service can complete a task. AgentResolver is the discovery/routing layer between intent and execution.

## MVP surfaces

- `POST /api/resolve` — free natural-language capability resolution
- `POST /api/execute` — execution gateway; paid execution intentionally disabled until wallet/facilitator configuration
- `/mcp` — MCP Streamable HTTP endpoint
- `/openapi.json` — runtime-generated OpenAPI 3.1 manifest
- `/llms.txt` — crawler/agent-readable service description
- `/capabilities.json` — runtime-generated capability metadata
- `server.json` — MCP Registry publisher metadata; update its remote URL after deployment

A2A metadata is intentionally **not** advertised until AgentResolver implements an actual A2A transport endpoint.

## Local development

```bash
npm install
npm run dev
```

Then:

```bash
curl -s http://localhost:3000/api/resolve \
  -H 'content-type: application/json' \
  -d '{"goal":"extract structured data from a JavaScript-heavy product page"}'
```

## Payment safety

The current version does **not** fake or bypass x402 verification. `/api/execute` remains disabled for paid capabilities until a receiving wallet and official x402 verification/settlement path are configured.

This keeps discovery testable immediately without risking unpaid executions or pretending that a client payment is valid.

## Launch checklist

1. CI build passes.
2. Import this repository into Vercel.
3. Set `NEXT_PUBLIC_BASE_URL` to the production origin.
4. Replace the placeholder remote URL in `server.json` with the deployed `/mcp` URL.
5. Verify `/api/health`, `/api/resolve`, `/mcp`, `/openapi.json`, `/llms.txt`, and `/capabilities.json`.
6. Only then configure wallet/payment variables and official x402 server integration.
7. Publish the live MCP endpoint to relevant discovery registries.

## Current experiment

The launch hypothesis is simple: if agents discover a genuinely useful free resolver, repeated capability resolution can create downstream paid executions. Early measurement should focus on organic machine calls, repeated usage, requested capabilities, and conversion to paid execution—not pageviews.
