# Production release — A2A discovery + isolated CDP Guard — 2026-09-21

This one-shot release publishes two already-green conversion surfaces in one measured production build.

Measured reasons for release:
- canonical production currently returns 404 at `/.well-known/agent-card.json`;
- AgentResolver is absent from the agent-tools.cloud A2A index;
- the official MCP Registry now exposes the paid-capable `/mcp` surface, but A2A discovery remains missing;
- the isolated Coinbase CDP settlement canary is healthy in production;
- `AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES` has been safely extended and verified as `x402-ping,x402-payment-preflight` without deploying;
- the useful verify-before-pay product therefore has a ready Base-only Coinbase-CDP route that can carry Bazaar settlement metadata.

Release behavior:
- publish `/.well-known/agent-card.json` using A2A v0.3 discovery metadata;
- publish free JSON-RPC `/a2a` `message/send` discovery/handoff;
- hand A2A callers to the existing paid `/api/x402-payment-preflight` ($0.001 Base/Solana) or `/api/verified-resolve` ($0.02);
- publish `/api/cdp-payment-guard` as an isolated Base-only Coinbase-CDP Guard at $0.002.

Preserved invariants:
- canonical `/api/payment-guard` and `/api/x402-payment-preflight` remain on their existing payment rails and pricing;
- canonical Guard price remains $0.001;
- payTo remains `0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8`;
- caller retains wallet custody and separately authorizes target payments;
- AgentResolver never receives caller private keys and never signs target payments;
- no self-payment, synthetic revenue, or owner-funded verification is performed;
- Circle Gateway remains disabled;
- no extra build should follow this release unless a measured defect is found.

Production before release:
- deployment: `dpl_Cc8QzgjLKg3UMRHP19HvahkdJBBr`;
- SHA: `ca1004cfe904c1dd2bde0c84e1fa09266a351ae3`;
- verified revenue: 5 external settlements / $0.005 USDC / $0 MRR.

Post-release verification:
- `/.well-known/agent-card.json` -> 200 and A2A card fields present;
- `/a2a` GET -> 200;
- JSON-RPC `message/send` -> canonical paid Guard handoff;
- `/api/cdp-payment-guard?url=https%3A%2F%2Fagentresolver.vercel.app%2Fapi%2Fx402-ping&method=GET&maxPriceUsd=0.01` -> unsigned $0.002 Base 402 on Coinbase CDP;
- canonical $0.001 Guard remains unchanged;
- check signed retries and `paid_capability_settled` after deployment.

## Release gate

AGENTRESOLVER_PRODUCTION_RELEASE_ONCE

Exactly one guarded Vercel production build is authorized by this marker.
