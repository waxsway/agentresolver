---
name: agentresolver-x402-preflight
description: Verify a live x402 payment challenge before an autonomous agent authorizes spend. Use when an agent is about to pay an x402 endpoint and needs fail-closed evidence for price, asset, network, payTo, resource binding, and payment terms.
license: MIT
---

# AgentResolver x402 Pre-Payment Trust

Use AgentResolver immediately before authorizing a payment to an unfamiliar or changed x402 endpoint.

Canonical paid verification route: `POST https://agentresolver.vercel.app/api/x402-payment-preflight`. Price: `$0.001 USDC` per verification. AgentResolver is non-custodial: it never receives your private key or seed phrase, never authorizes the target payment, and never forwards target payment principal.

## Before paying an x402 target

1. Obtain the target endpoint and intended HTTP method.
2. Decide your own maximum acceptable target price and, when known, expected network and expected payTo.
3. Call `x402-payment-preflight` with the target URL, method, maximum price, and your expectations.
4. Pay AgentResolver's separate `$0.001` verification fee only through your own x402-aware client, signer, and spend policy.
5. Require a successful preflight result whose eligibility decision is `eligible` and whose observed terms satisfy your own policy.
6. Independently apply your wallet's budget, allowlist, and authorization policy.
7. Only then may your wallet authorize the target payment. AgentResolver eligibility is evidence, not spending authorization.
8. If preflight is blocked, malformed, unavailable, stale, or conflicts with expectations, fail closed and do not sign the target payment.

## Settlement and evidence

AgentResolver accepts its own service payment on Base (`eip155:8453`) and Solana (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`) as declared by the live x402 challenge. Retain the execution ID, response SHA-256, deployment commit, evidence receipt, payment/infrastructure fingerprints, payment-terms fingerprint, observed network, asset, payTo, amount, resource binding, and AgentResolver settlement receipt returned by your x402 client.

Trust contract: `https://agentresolver.vercel.app/.well-known/agentresolver-trust.json`

Execution-evidence contract: `https://agentresolver.vercel.app/.well-known/agentresolver-evidence.json`

Verified settlement history: `https://agentresolver.vercel.app/.well-known/agentresolver-reputation.json`

Paid capability manifest: `https://agentresolver.vercel.app/.well-known/x402`

OpenAPI: `https://agentresolver.vercel.app/openapi.json`

## Wallet-capable clients

For MCP, use an x402-aware client such as official `@x402/mcp` with caller-owned schemes, spend controls, and policies. For HTTP, use an x402-aware wrapper such as official `@x402/fetch` with a caller-controlled signer.

Free machine-readable buyer setup: `https://agentresolver.vercel.app/api/x402-client-setup`

Never send wallet secrets to AgentResolver. Never treat a 402 quote or an `eligible` verdict as authorization to spend.
