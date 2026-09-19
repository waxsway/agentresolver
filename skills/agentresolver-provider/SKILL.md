---
name: agentresolver-provider
description: Enroll an x402 machine-service provider into AgentResolver's zero-account provider network, verify same-origin payment identity, bootstrap immediate procurement, and prepare provider-owned durable discovery and verified success-fee settlement without giving AgentResolver wallet keys or custody.
license: MIT
---

# AgentResolver Provider Enrollment

Use this skill when the current agent operates an x402 service and wants AgentResolver to procure and route compatible machine demand to it.

AgentResolver provider enrollment is machine-native and zero-account. Do not email an operator or submit wallet/private-key material.

## 1. Publish the provider manifest

Publish:

```text
https://YOUR-DOMAIN/.well-known/agentresolver-provider.json
```

Validate it against:

```text
https://agentresolver.vercel.app/provider-manifest.schema.json
```

Example:

```text
https://agentresolver.vercel.app/provider-manifest.example.json
```

The manifest can only enroll routes on the same public HTTPS origin. Current domain-provider commerce terms are:

- network: Base (`eip155:8453`)
- asset: canonical Base USDC
- provider success fee: 2% of independently verified routed GMV
- minimum success fee: $0.001 USDC
- extra AgentResolver buyer fee: $0
- account/email/API key/wallet key required by AgentResolver: no

The listed route must return its x402 v2 402 challenge before performing business side effects. AgentResolver verifies the challenge without a payment signature.

## 2. Bootstrap the provider

Preferred full MCP surface:

```text
https://agentresolver.vercel.app/mcp
```

Call the free `provider_bootstrap` tool with:

```json
{
  "origin": "https://YOUR-DOMAIN"
}
```

REST equivalent:

```text
POST https://agentresolver.vercel.app/api/provider-bootstrap
Content-Type: application/json
```

```json
{
  "origin": "https://YOUR-DOMAIN"
}
```

Optionally specify up to five `routeIds`.

AgentResolver reads only the fixed well-known manifest and live-verifies the selected same-origin x402 routes. It does not persist provider state and does not send an external registration.

If no route appears in `verifiedRoutes`, do not advertise the provider as enrolled. Fix the manifest/challenge mismatch first.

## 3. Use the provider immediately

A successful bootstrap response includes:

```text
immediateProcurement.rest.addToRequest.providerOrigins
```

A buyer or test agent can add that value to free procurement immediately:

```json
{
  "goal": "search the public web",
  "providerOrigins": ["https://YOUR-DOMAIN"],
  "constraints": {
    "protocol": "x402",
    "requireHttps": true
  }
}
```

Use:

```text
POST https://agentresolver.vercel.app/api/procure
```

or the free `procure` tool at:

```text
https://agentresolver.vercel.app/mcp/control
```

AgentResolver still ranks against buyer constraints. Supplying a provider origin does not force selection.

## 4. Bootstrap durable discovery

For each verified route, the bootstrap response may include:

```text
verifiedRoutes[].durableDiscoveryBootstrap.action
```

That is a caller-owned anonymous registration action for 402 Index.

AgentResolver does **not** send this request. The provider or its agent decides whether to send it directly. The external registry independently probes/reviews the route and may reject or delay listing.

Do not repeatedly register the same route just to manufacture traffic or visibility.

Once accepted by an upstream catalog that AgentResolver ingests, buyers no longer need to know the provider origin in advance.

## 5. Preserve attribution headers

When AgentResolver routes a buyer to the provider, the handoff can include:

```text
x-agentresolver-attribution-id
```

and, when the dedicated attribution signer is active:

```text
x-agentresolver-attribution-receipt
```

The provider should preserve both values with the routed request/settlement record.

The signed receipt binds the AgentResolver handoff to the provider, route, capability, endpoint, method, price, network, asset, payTo, and amount. Never attempt to mint or modify the receipt.

## 6. Prove the buyer settlement

After a routed Base-USDC sale, call:

```text
POST https://agentresolver.vercel.app/api/provider-attribution-verify
```

Provide:

- `attributionId`
- `providerId`
- `routeId`
- `providerOrigin` for domain-manifest providers
- `buyerTxHash`
- `attributionReceipt` when the signed receipt was supplied in the handoff

AgentResolver re-resolves the provider route and independently verifies the Base-USDC buyer settlement against the published payment identity.

If the dedicated signer is active, missing, expired, tampered, or mismatched attribution receipts fail fee eligibility closed.

## 7. Settle the success fee

The verified conversion response can include the exact AgentResolver success-fee quote.

The provider may also request it at:

```text
POST https://agentresolver.vercel.app/api/provider-success-fee-quote
```

After the provider sends the exact quoted Base-USDC fee transfer using its own wallet and policy, prove it at:

```text
POST https://agentresolver.vercel.app/api/provider-success-fee-verify
```

AgentResolver independently re-verifies:

1. buyer → provider Base-USDC settlement;
2. the signed AgentResolver handoff receipt when signing is active; and
3. provider → AgentResolver exact success-fee transfer.

Do not count a quote, unsigned attribution, failed proof, probe, or unrelated wallet transfer as settled provider revenue.

## Optional deeper verification

`/api/provider-launch-check` remains available as an optional $0.05 x402 technical readiness audit.

It is not an admission gate for domain-controlled provider enrollment and does not buy ranking.

## Boundaries

AgentResolver provider enrollment never requires the provider to:

- give AgentResolver a private key or seed phrase
- give AgentResolver custody of buyer/provider funds
- let AgentResolver authorize provider spending
- let AgentResolver proxy arbitrary provider requests
- give AgentResolver an email/account merely to enroll
- trust manifest payment identity without a matching live x402 challenge
- treat external registry acceptance as guaranteed

The provider remains responsible for fulfillment, its wallet, its external registrations, and all spending decisions.
