---
name: agentresolver-payment-guard
description: Verify live x402 payment terms before an autonomous agent authorizes USDC spend. Use immediately before paying an unfamiliar or changed x402 endpoint and fail closed when observed terms conflict with caller policy.
license: MIT
---

# AgentResolver Payment Guard

Use AgentResolver Guard immediately before each autonomous x402 spend to inspect the target's live payment challenge before the caller decides whether to sign.

Preferred HTTP call:

`GET https://agentresolver.vercel.app/api/payment-guard?url=<encoded-public-https-target>&method=<GET|POST>&maxPriceUsd=<caller-limit>`

Price: **$0.001 USDC** per verification.

Required query:
- `url`: public HTTPS x402 endpoint to inspect.

Optional assertions:
- `method`
- `maxPriceUsd`
- `expectedPayTo`
- `expectedNetwork`
- `allowUnpaidPostProbe`

The stable underlying capability is `x402-payment-preflight`. The canonical compatibility endpoint `GET /api/x402-payment-preflight` remains supported. POST remains available when body-bearing compatibility is required.

## Before paying an x402 target

1. Obtain the exact target endpoint and intended method without signing its payment.
2. Call AgentResolver Guard with the target URL and caller-defined constraints.
3. Pay AgentResolver's separate $0.001 verification fee only through a caller-owned signer and caller-owned spend policy.
4. Require a successful Guard result with `decision === "eligible"`.
5. Validate the returned amount, asset, network, scheme, payTo, resource binding, fingerprints, and evidence against caller policy.
6. Only then may the caller-owned wallet independently decide whether to authorize and sign the target payment.
7. Repeat Guard before each later unfamiliar or changed x402 spend.

`eligible` means the observed terms passed the requested checks. It **does not authorize spending**.

If Guard is blocked, malformed, unavailable, stale, or conflicts with expectations, fail closed and do not sign the target payment.

## Wallet-capable clients

A plain HTTP or MCP client can read a 402 challenge but cannot produce a signed retry by itself.

Free machine-readable buyer setup:
`https://agentresolver.vercel.app/api/x402-client-setup`

For TypeScript:
- HTTP: `@x402/fetch` with `wrapFetchWithPayment`
- MCP: `@x402/mcp` with `createx402MCPClient`
- Base exact scheme: `@x402/evm/exact/client`
- Solana exact scheme: `@x402/svm/exact/client`

AgentResolver accepts its own service payment on:
- Base: `eip155:8453`
- Solana: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`

Use only a caller-controlled signer. Never send a private key or seed phrase to AgentResolver.

## MCP

Remote MCP:
`https://agentresolver.vercel.app/mcp`

Use `payment_guard` for the same $0.001 pre-payment check. Free `resolve` can recommend the canonical `x402-payment-preflight` capability for payment-verification intent.

## Settlement and evidence

Retain the Guard decision, reason codes, observed target payment terms, payment and endpoint fingerprints, execution ID, response SHA-256, deployment commit, evidence receipt, and AgentResolver settlement receipt returned by the caller's x402 client.

Trust contract:
`https://agentresolver.vercel.app/.well-known/agentresolver-trust.json`

Execution-evidence contract:
`https://agentresolver.vercel.app/.well-known/agentresolver-evidence.json`

Verified settlement history:
`https://agentresolver.vercel.app/.well-known/agentresolver-reputation.json`

Paid capability manifest:
`https://agentresolver.vercel.app/.well-known/x402`

OpenAPI:
`https://agentresolver.vercel.app/openapi.json`

## Authorization boundary

AgentResolver never signs target payments, controls the caller's wallet, receives wallet secrets, authorizes target spend, custodies target principal, certifies legal wallet ownership, or guarantees provider honesty or future fulfillment.

A 402 challenge is a quote, not authorization. An `eligible` verdict is evidence, not permission to spend.
