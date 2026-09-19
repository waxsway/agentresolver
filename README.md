# AgentResolver

AgentResolver is a **stable open-world fallback for autonomous agents**.

Keep the tools your agent already has. Add one lean AgentResolver control plane behind them. When the installed tool set cannot satisfy a task, AgentResolver can search external MCP/API/x402 supply and return bounded candidates, contract evidence, and a non-custodial handoff without taking execution or spending authority.

The default MCP surface stays intentionally small: **two free tools — `procure` and `resolve` — instead of hundreds of pre-attached external tools.**

**Production:** https://agentresolver.vercel.app

## Install as a persistent fallback

Remote Streamable HTTP MCP control-plane endpoint:

```text
https://agentresolver.vercel.app/mcp/control
```

The full compatibility MCP surface remains available at `https://agentresolver.vercel.app/mcp`.

Portable MCP configuration:

```json
{
  "servers": {
    "agentresolver": {
      "type": "http",
      "url": "https://agentresolver.vercel.app/mcp/control"
    }
  }
}
```

Official MCP Registry name:

```text
io.github.waxsway/agentresolver
```

The official MCP Registry entry points at the lean control plane with exactly two free tools: `procure` for constrained capability selection and `resolve` for broad discovery. Paid tools are intentionally excluded from the default control-plane entrypoint.


### Runtime policy

Use native/installed tools first. Call AgentResolver only when no installed capability clearly fits.

- `procure` — constrained external-capability selection.
- `resolve` — broad discovery when exact constraints are not available.
- paid verification — separate, explicit and caller-authorized when fresh live evidence is worth paying for.
- third-party execution/payment — remains under the calling runtime's own policy.

AgentResolver is not a wallet, payment signer, or arbitrary execution proxy.

## Framework-native fallback recipes

Machine-readable recipes for OpenAI Agents, Cloudflare Agents, portable MCP hosts, and AI SDK-compatible runtimes:

`https://agentresolver.vercel.app/framework-integrations.json`

The default remote MCP is the lean control plane at `/mcp/control`, exposing only free `procure` and `resolve`. Paid verification remains a separate caller-authorized path.

## Use AgentResolver as an agent fallback

If you build an autonomous agent, add this behavior to its tool-selection policy:

> When no already-connected tool clearly satisfies the task, call AgentResolver `procure` with the required budget/network/protocol/schema constraints. If exact constraints are unavailable, use `resolve`. Both free surfaces are non-custodial and do not authorize spending.

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

- `POST /api/resolve` — free natural-language capability resolution plus registered provider routes
- `POST /api/execute` — registered-provider handoff + attribution; never an arbitrary proxy or spender
- `GET /api/providers` — machine-readable provider network and provider-funded pilot terms
- `POST /api/provider-launch-check` — $0.05 x402 seller-side readiness/payment-contract check that returns a bounded provider registry packet
- `POST /api/provider-attribution-settle` — $0.001 provider-funded attribution-fee settlement
- `/provider-integration.json` — SDKless provider routing/attribution contract
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

## Provider network

Providers can join AgentResolver distribution without an account, email form, API key, or manual review by publishing a same-origin `/.well-known/agentresolver-provider.json` manifest.

The provider manifest may advertise only routes on the provider's own HTTPS origin. AgentResolver reconciles the live x402 payment identity and routes buyers directly to the provider; AgentResolver never holds buyer funds, wallet keys, or payment signatures and never authorizes buyer spend.

For domain-enrolled routes, the commercial model is a **2% provider-funded success fee on independently verified routed GMV, with a $0.001 minimum and $0 additional buyer fee**. A provider first proves the buyer-to-provider Base USDC settlement, receives the exact attribution-bound fee quote, then can prove the provider-to-AgentResolver fee transfer. Paid launch verification remains an optional readiness/trust check rather than an admission gate.

Machine contracts:
- `GET /api/providers` — provider enrollment and commercial terms
- `POST /api/provider-attribution-verify` — independently verify buyer settlement
- `POST /api/provider-success-fee-quote` — exact provider success-fee quote
- `POST /api/provider-success-fee-verify` — independently verify provider fee settlement
- `/provider-integration.json` — full machine-readable contract
- `/provider-manifest.example.json` — self-enrollment manifest example

Provider details: https://agentresolver.vercel.app/providers

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

The canonical x402 payment preflight returns a machine-readable evidence receipt with stable SHA-256 fingerprints for the observed payment identity (network + asset + payTo), endpoint/payment pairing, and payment terms. These receipts are designed for change detection across observations; they do not claim that AgentResolver has established legal ownership of a wallet, provider legitimacy, or future fulfillment. The receipt also exposes ERC-8004-shaped candidate feedback signals (for example reachability and response time) as off-chain evidence only; AgentResolver does not submit them on-chain or bind them to an ERC-8004 identity unless that identity is independently established.

AgentResolver publishes a machine-readable trust contract at `/.well-known/agentresolver-trust.json`, including the canonical paid route, supported networks/assets, non-custodial payment boundary, trust limitations, source repository, security disclosure path, and the Vercel deployment commit SHA when available.

Resolution and MCP quote tools never spend money. AgentResolver's direct paid endpoints use x402 USDC on Base or Solana and execute only after a caller supplies a valid payment authorization; successful revenue is counted only from confirmed settlement receipts. `/api/execute` is a registered-provider handoff router: it creates attribution and returns the selected registered request contract, but does not proxy generic third-party execution or authorize target spend.

Marketplace results can contain third-party payment requirements. Calling agents must apply their own authorization, budget, trust, and safety policy before paying or invoking any third-party service.

## Cost controls

Crawler-heavy metadata is served as static content where possible. Upstream discovery is cached and bounded by short timeouts. Resolver goal, URL, and result limits are capped to reduce abuse and accidental compute/network amplification.

## Telemetry

Resolver and MCP calls emit privacy-conscious structured logs with one-way caller/goal hashes, user-agent, coarse intent tags, aggregate match counts, provider demand signals, routing handoffs, and attributed paid responses. Raw goals and raw IP addresses are not written by the provider-routing layer.

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
