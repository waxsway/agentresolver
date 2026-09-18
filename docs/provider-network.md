# AgentResolver Provider Network

AgentResolver can route agent intent to registered machine services without acting as a wallet, custodian, or arbitrary proxy.

## Buyer flow

1. Call `POST /api/resolve` for free.
2. Select a returned `providerRoutes` entry.
3. Call `POST /api/execute` with its `routeId` and capability input.
4. AgentResolver returns an execution-ready handoff plus an `atr_...` attribution ID.
5. The caller independently applies its own trust and spending policy and calls the provider directly.
6. Preserve `x-agentresolver-attribution-id` on AgentResolver-owned routes so paid delivery can be correlated.

`/api/execute` never accepts an arbitrary target URL and never forwards wallet keys, cookies, authorization headers, or payment signatures.

## Provider-funded pilot

A reviewed provider can opt into a fixed **$0.001 USDC success fee** for an attributed fulfilled request.

The provider settles the fee through:

`POST /api/provider-attribution-settle`

Input:

```json
{
  "attributionId": "atr_00000000-0000-4000-8000-000000000000",
  "providerId": "example-provider",
  "outcome": "fulfilled",
  "externalTransactionRef": "optional-provider-reference"
}
```

The optional external reference is hashed before telemetry/output. A successful x402 payment proves the provider paid AgentResolver's attribution fee. It does **not** by itself prove the underlying buyer transaction or provider fulfillment.

## Partner registry

Reviewed partner routes can be configured through `AGENTRESOLVER_PROVIDER_REGISTRY_JSON`. The parser is bounded and fail-closed. Every route is a direct HTTPS x402 handoff; no partner configuration can enable arbitrary proxy execution.

Required partner fields:

```json
[
  {
    "routeId": "provider:capability",
    "providerId": "provider",
    "providerName": "Provider",
    "capabilityId": "capability",
    "name": "Capability name",
    "description": "What the machine service does",
    "tags": ["search", "data"],
    "endpoint": "https://provider.example/api/capability",
    "method": "POST",
    "priceUsd": 0.01,
    "network": "eip155:8453",
    "commissionUsd": 0.001
  }
]
```

At launch, the success-fee pilot is intentionally fixed at $0.001 so provider settlement has one deterministic x402 contract.

## Demand telemetry

AgentResolver emits privacy-conscious structured events for qualified demand and routing:

- `provider_demand_signal`
- `provider_route_handoff`
- `attributed_paid_response`
- `provider_attribution_fee_fulfilled`

Raw goals and raw IP addresses are not written by this provider-routing layer. Goal and caller identifiers are one-way hashed where correlation is needed.

Durable customer-facing analytics storage is intentionally not added until a storage service is explicitly approved. Existing Vercel runtime telemetry is the operator reporting source in the pilot.
