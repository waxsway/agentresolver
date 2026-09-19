# AgentResolver provider onboarding

AgentResolver provider enrollment is machine-native, zero-account, and domain-controlled.

## 1. Publish one well-known manifest

Publish this JSON at:

```text
https://YOUR-DOMAIN/.well-known/agentresolver-provider.json
```

Use the machine-readable example at:

```text
https://agentresolver.vercel.app/provider-manifest.example.json
```

The manifest can enroll only paid routes on the **same HTTPS origin**. That prevents one domain from claiming another provider's endpoint.

The current commerce contract is:

- settlement network: Base (`eip155:8453`)
- asset: canonical Base USDC
- provider success fee: **2% of verified routed GMV**
- minimum success fee: **$0.001 USDC**
- extra fee charged to the buyer by AgentResolver: **$0**
- provider account, email, API key, wallet key, or custody: **not required**

Publishing the manifest is the provider's machine-readable opt-in to these terms and to a bounded unsigned challenge probe used to verify the listed x402 payment identity. For a declared GET route AgentResolver sends one unpaid GET; for a declared POST route it may send one empty JSON POST. The route must return the x402 402 challenge before any business side effect. AgentResolver never sends a payment signature during enrollment.

## 2. Be discoverable

AgentResolver can recognize the manifest when the same provider route appears in a supported external capability catalog such as PayAI/Circle discovery.

A compatible domain-enrolled candidate remains subject to the buyer's requested budget, network, protocol, and schema constraints. Provider-funded economics do not override hard buyer constraints.

Before AgentResolver attaches provider attribution or payment identity to procurement, the live route must return a parseable x402 v2 `PAYMENT-REQUIRED` challenge whose exact scheme, Base network, canonical Base USDC asset, payTo, amount, and resource binding match the well-known manifest. Missing, malformed, mismatched, non-402, cross-origin, private/local, or oversized enrollment evidence fails closed.

When a domain-enrolled provider is selected, AgentResolver returns an `x-agentresolver-attribution-id` in the procurement handoff. The calling agent should send that exact header to the provider when it executes the selected route.

## 3. Prove the routed buyer settlement

After a routed sale, call:

```text
POST /api/provider-attribution-verify
```

with:

- `attributionId`
- `providerId`
- `routeId`
- `providerOrigin`
- `buyerTxHash`

AgentResolver re-fetches the provider's well-known manifest and independently verifies the Base-USDC buyer settlement against the payment identity published for that route.

A successful response includes an exact success-fee quote.

## 4. Settle the success fee

You may separately request the quote at:

```text
POST /api/provider-success-fee-quote
```

The quote returns the exact Base-USDC amount and AgentResolver payTo address.

The amount is the greater of 2% of routed GMV or $0.001, plus a tiny deterministic atomic-unit suffix derived from the attribution ID. That suffix binds the fee proof to one attribution so the same same-sized fee transfer cannot be replayed across multiple routed conversions.

After sending the exact Base-USDC fee transfer, prove it at:

```text
POST /api/provider-success-fee-verify
```

using the same conversion fields plus `feeTxHash`.

AgentResolver independently verifies both:

1. buyer → provider Base-USDC settlement; and
2. provider → AgentResolver exact success-fee transfer.

## Optional paid launch check

`/api/provider-launch-check` remains available for a deeper $0.05 x402 technical readiness/payment-contract audit.

It is **not required for admission** to domain-controlled provider routing.

## Boundaries

AgentResolver does not hold buyer wallet keys, authorize buyer spend, proxy arbitrary provider requests, or custody buyer funds.

Current proof establishes domain control, the provider's published payment identity, the buyer's Base-USDC settlement, and the provider's success-fee transfer. The procurement attribution ID is not yet cryptographically signed by AgentResolver.
