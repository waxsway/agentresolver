# AgentResolver x402 monetization

AgentResolver's primary machine-economy model is pay-per-call, not a mandatory provider subscription.

## Settlement

- Network: Base (`eip155:8453`)
- Asset: USDC
- Receiving address: `0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8`
- Discovery remains free.
- Resolver results never authorize spending on behalf of an agent.

## Revenue path

1. An agent discovers AgentResolver through MCP/OpenAPI/registry metadata.
2. `resolve` remains free and returns relevant capabilities.
3. AgentResolver-owned paid resources advertise an explicit x402 price.
4. An unpaid request receives HTTP 402 payment requirements.
5. The caller decides whether its own wallet/spending policy permits payment.
6. After facilitator verification and settlement, the paid resource is returned.
7. USDC settles to the receiving address above.

## Initial pricing

The first paid resource is targeted at `$0.01` per successful paid request. Pricing should be changed only after observing real paid demand and resource cost.

## Safety / cost controls

- Never require a private key or seed phrase on the AgentResolver server.
- The resource server is configured with only a public payout address.
- Do not enable a mainnet facilitator until its fees, limits, network support, and production terms have been verified.
- Do not add paid infrastructure without owner approval.
- Do not put ordinary capability discovery behind a paywall.

## Launch gate

The repository already contains the official x402 TypeScript packages. Before mainnet activation, choose and verify a production facilitator that supports Base mainnet USDC. The x402 Foundation documentation explicitly advises production sellers not to assume the public x402.org facilitator is the default production path for mainnet EVM routes.
