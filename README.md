# AgentResolver

AgentResolver is machine-first routing infrastructure for autonomous agents.

An agent describes what it needs. AgentResolver returns ranked compatible capabilities, pricing metadata, and an execution path. Resolution is free; paid capabilities can later use x402 without forcing the human-facing subscription model onto machine callers.

## Why this exists

Agents should not need dozens of hard-coded integrations just to figure out what external service can complete a task. AgentResolver is the discovery/routing layer between intent and execution.

## MVP surfaces

- `POST /api/resolve` — free natural-language capability resolution
- `POST /api/execute` — execution gateway; paid execution intentionally disabled until wallet/facilitator configuration
- `/mcp` — MCP 2026 Streamable HTTP endpoint
- `/openapi.json` — OpenAPI 3.1 manifest
- `/.well-known/agent-card.json` — A2A discovery metadata
- `/llms.txt` — crawler/agent-readable service description
- `/capabilities.json` — compact capability metadata
- `server.json` — official MCP Registry publisher metadata

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

The first commit does **not** fake or bypass x402 verification. `/api/execute` remains disabled for paid capabilities until a receiving wallet, USDC asset address, and facilitator/payment-verification implementation are configured.

This keeps discovery testable immediately without risking unpaid executions or pretending that a client payment is valid.

## Current experiment

The launch hypothesis is simple: if agents discover a genuinely useful free resolver, repeated capability resolution can create downstream paid executions. Early measurement should focus on organic machine calls, repeated usage, requested capabilities, and conversion to paid execution—not pageviews.
