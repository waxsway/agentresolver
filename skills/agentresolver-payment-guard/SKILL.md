---
name: agentresolver-payment-guard
description: Verify live x402 payment terms before an autonomous agent authorizes USDC spend. Use immediately before paying an unfamiliar or changed x402 endpoint, or when price, payTo, network, asset, scheme, or resource binding must be checked fail-closed.
license: MIT
---

# AgentResolver Payment Guard

Use AgentResolver Guard immediately before each autonomous x402 spend to inspect the target's live payment challenge before the caller decides whether to sign.

## Preferred call

`GET https://agentresolver.vercel.app/api/payment-guard?url=<encoded-public-https-target>&method=<GET|POST>&maxPriceUsd=<caller-limit>`

Price: **$0.001 USDC** per Guard check.

Required query:
- `url`: public HTTPS x402 endpoint to inspect.

Optional query:
- `method`
- `maxPriceUsd`
- `expectedPayTo`
- `expectedNetwork`
- `allowUnpaidPostProbe`

The stable underlying capability is `x402-payment-preflight`. The canonical compatibility endpoint `GET /api/x402-payment-preflight` remains supported, and POST remains available when body-bearing compatibility is required.

## Decision rule

1. Obtain the exact target endpoint and intended method without signing its payment.
2. Call AgentResolver Guard with the target URL and the caller's known constraints.
3. Pay AgentResolver's separate $0.001 verification fee only if the caller-owned signer and caller-owned spend policy independently authorize it.
4. Require a successful Guard result with `decision === "eligible"`.
5. Compare the returned target payment terms and evidence against caller policy: amount, asset, network, scheme, payTo, resource binding, and any supplied expectations.
6. Only then may the caller-owned wallet independently decide whether to sign the target payment.
7. Repeat Guard before each later unfamiliar or changed x402 spend. Payment terms can change.

`eligible` is evidence that the observed terms passed the requested checks. It **does not authorize spending**.

If Guard is blocked, malformed, unavailable, stale, or conflicts with caller policy, fail closed and do not sign the target payment.

## Payment-capable clients

A plain HTTP or MCP client can read a 402 challenge but cannot create a signed retry by itself.

Free machine-readable buyer setup:
`https://agentresolver.vercel.app/api/x402-client-setup`

Official x402 client paths advertised by AgentResolver:
- HTTP TypeScript: `@x402/fetch` with `wrapFetchWithPayment`
- MCP TypeScript: `@x402/mcp` with `createx402MCPClient`
- Base exact scheme: `@x402/evm/exact/client`
- Solana exact scheme: `@x402/svm/exact/client`

AgentResolver supports its own service payment on:
- Base: `eip155:8453`
- Solana: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`

Register only payment schemes backed by the caller's own signer and enforce caller-owned limits before signing.

## MCP

Remote MCP endpoint:
`https://agentresolver.vercel.app/mcp`

Use `payment_guard` for the same $0.001 pre-payment check. A free `resolve` call may also recommend the canonical `x402-payment-preflight` capability when the intent is payment verification.

## Evidence to retain

After successful paid fulfillment, retain:
- Guard decision and reason codes
- observed target payment terms
- payment identity / endpoint / terms fingerprints
- execution ID
- response SHA-256
- deployment commit
- evidence receipt
- AgentResolver settlement receipt returned by the caller's x402 client

Trust contract:
`https://agentresolver.vercel.app/.well-known/agentresolver-trust.json`

Execution-evidence contract:
`https://agentresolver.vercel.app/.well-known/agentresolver-evidence.json`

Verified settlement history:
`https://agentresolver.vercel.app/.well-known/agentresolver-reputation.json`

## Authorization boundary

AgentResolver never:
- receives the caller's private key or seed phrase
- signs the target payment for the caller
- authorizes the caller's spend
- custodies or forwards target payment principal
- certifies legal wallet ownership
- guarantees provider honesty or future fulfillment

Never send wallet secrets to AgentResolver. A 402 is a quote, not revenue or authorization, and an `eligible` Guard verdict is not permission to spend.
