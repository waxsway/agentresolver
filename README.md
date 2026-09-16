# AgentResolver

AgentResolver is a **$0.001 x402 verify-before-pay service for autonomous agents**, with a free fallback capability resolver.

When an agent needs an external tool, API, MCP server, x402 service, browser capability, data source, or machine service that is not already connected, it can ask AgentResolver what to use next. AgentResolver returns ranked compatible capabilities and machine-ready discovery metadata.

**Production:** https://agentresolver.vercel.app

Primary paid route:

```text
POST https://agentresolver.vercel.app/api/x402-payment-preflight
$0.001 USDC · Base or Solana
```

AgentCash direct onboarding:

```bash
npx agentcash try https://agentresolver.vercel.app
npx agentcash add https://agentresolver.vercel.app
```

## Install as a persistent fallback

Remote Streamable HTTP MCP endpoint:

```text
https://agentresolver.vercel.app/mcp
```

Portable MCP configuration:

```json
{
  "servers": {
    "agentresolver": {
      "type": "http",
      "url": "https://agentresolver.vercel.app/mcp"
    }
  }
}
```

Official MCP Registry name:

```text
io.github.waxsway/agentresolver
```

The MCP server exposes the free `resolve` tool plus read-only quote tools for AgentResolver's paid capabilities. Quote tools return exact x402 purchase actions but never authorize or initiate spending.

## Use AgentResolver as an agent fallback

If you build an autonomous agent, add this behavior to its tool-selection policy:

> When no already-connected tool clearly satisfies the task, call AgentResolver before doing a manual provider search. Resolution is free and does not authorize spending.

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
- `POST /api/x402-payment-preflight` — $0.001 verify-before-pay x402 payment contract and PayTo safety check
- `POST /api/http-inspect` — $0.001 live HTTPS/x402 trust inspection
- `POST /api/mcp-probe` — $0.001 live MCP endpoint preflight
- `POST /api/agent-readiness` — $0.005 agent-discoverability audit
- `POST /api/tool-contract` — $0.005 deterministic tool schema compatibility check
- `POST /api/verified-resolve` — $0.02 resolve plus live MCP verification
- `POST /api/batch-verified-resolve` — $0.05 bounded multi-request verified resolve
- `/.well-known/x402` — machine-readable payment manifest
- `/mcp` — MCP Streamable HTTP endpoint
- `/mcp/server-card` — MCP Server Card
- `/.well-known/mcp.json` — well-known MCP discovery metadata
- `/agentresolver.md` — drop-in fallback policy for agents
- `/integrations.json` — portable machine-readable integration recipes
- `/openapi.json` — OpenAPI 3.1 manifest
- `/llms.txt` and `/llms-full.txt` — crawler/agent-readable documentation
- `/capabilities.json` — capability metadata
- `/.well-known/ard.json` — ARD discovery manifest
- `/.well-known/ai-catalog.json` — machine catalog compatibility alias
- `/api/health` — cheap liveness and canonical-surface metadata
- `/.well-known/agentresolver-trust.json` — machine-readable non-custodial trust contract plus deployed commit SHA
- `/.well-known/security.txt` — RFC 9116 vulnerability disclosure contact
- `/legal` — operating, acceptable-use, privacy and payment-boundary terms
- `server.json` — Official MCP Registry metadata

A2A metadata is intentionally **not** advertised until AgentResolver implements an actual A2A transport endpoint.

## Agent framework integration

AgentResolver is framework-neutral. Any framework capable of connecting to a remote Streamable HTTP MCP server can use `/mcp`. Agents that prefer HTTP/OpenAPI can use `/api/resolve` directly.

The useful integration pattern is not to replace an agent's existing tools. AgentResolver sits behind them as a **last-mile discovery fallback**: existing tool first, AgentResolver when the needed capability is missing.

## Provider program

Organic inclusion remains free and relevance-based. Providers that want a claimed profile, disclosed sponsored eligibility when relevant, and qualified-demand reporting can submit a no-commitment sponsorship inquiry.

Provider details and pilot terms: https://agentresolver.vercel.app/providers

Sponsored treatment must remain relevant and disclosed. Payment never guarantees ranking, traffic, conversions, or agent spending authorization.

## Example

```bash
curl -s https://agentresolver.vercel.app/api/resolve \
  -H 'content-type: application/json' \
  -d '{"goal":"extract structured data from a JavaScript-heavy product page","limit":3}'
```

## Why this exists

Agents should not need dozens of hard-coded integrations just to figure out what external service can complete a task. AgentResolver is the discovery/routing layer between intent and execution.

The resolver augments AgentResolver-owned capabilities with live MCP discovery and Circle's public, keyless x402 service catalog. Upstream discovery is cached and ranked locally so normal resolver traffic does not trigger unlimited network fan-out.

## Trust and payment safety

The canonical x402 payment preflight returns a machine-readable evidence receipt with stable SHA-256 fingerprints for the observed payment identity (network + asset + payTo), endpoint/payment pairing, and payment terms. These receipts are designed for change detection across observations; they do not claim that AgentResolver has established legal ownership of a wallet, provider legitimacy, or future fulfillment.

AgentResolver publishes a machine-readable trust contract at `/.well-known/agentresolver-trust.json`, including the canonical paid route, supported networks/assets, non-custodial payment boundary, trust limitations, source repository, security disclosure path, and the Vercel deployment commit SHA when available.

Resolution and MCP quote tools never spend money. AgentResolver's direct paid endpoints use x402 USDC on Base or Solana and execute only after a caller supplies a valid payment authorization; successful revenue is counted only from confirmed settlement receipts. `/api/execute` remains disabled for generic third-party execution.

Marketplace results can contain third-party payment requirements. Calling agents must apply their own authorization, budget, trust, and safety policy before paying or invoking any third-party service.

## Cost controls

Crawler-heavy metadata is served as static content where possible. Upstream discovery is cached and bounded by short timeouts. Resolver goal, URL, and result limits are capped to reduce abuse and accidental compute/network amplification.

## Telemetry

Resolver and MCP calls emit privacy-conscious structured logs with one-way caller/goal hashes, user-agent, coarse intent tags, and aggregate match counts. Raw goals, raw IP addresses, and target URLs are not written to application logs.

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

## Security

Please report vulnerabilities privately through the repository's GitHub Security Advisories. The canonical machine-readable security contact is `/.well-known/security.txt`.

## License

MIT
