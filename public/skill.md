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


## MCP wallet-capable clients — fail-closed pre-sign gate

For `@x402/mcp`, set `onPaymentRequested` so the host's own policy approves the separate Guard fee before payment creation. Fail closed unless the tool is mapped to its exact MCP resource:

- `payment_guard` → `mcp://tool/payment_guard`
- `x402_payment_preflight` → `mcp://tool/x402_payment_preflight`

Require x402 v2, `scheme === "exact"`, `amount === "1000"`, and an exact match for one advertised Base or Solana network / USDC asset / AgentResolver payTo tuple. Use exact string equality for Solana Base58 asset and payTo values; never lowercase or otherwise normalize them.

The complete copy-pasteable callback and HTTP pre-sign equivalents are published at:
`https://agentresolver.vercel.app/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md`

The host must still independently authorize the target payment after Guard succeeds.

## Coinbase AgentKit

For Coinbase AgentKit, use its built-in confirmation-first x402 actions instead of writing a custom payment loop. AgentKit only allows HTTP x402 actions against registered services, and dynamic registration is disabled by default unless the host enables it.

1. Call `list_registered_services` before the first request.
2. Ensure the exact target and `https://agentresolver.vercel.app` are approved. If `allowDynamicServiceRegistration` is enabled, intentionally call `register_x402_service` for each. Otherwise the host administrator must include them in `registeredServices`.
3. Call `make_http_request` on the approved exact target. This exposes the target's 402 terms without paying.
4. Build the AgentResolver Guard URL with that target plus caller-owned constraints and call `make_http_request` on the approved AgentResolver origin. This exposes Guard's separate $0.001 challenge without paying.
5. Only if the caller's own policy authorizes the Guard fee, call `retry_http_request_with_x402` for Guard.
6. Require `decision === "eligible"` and compare the observed amount, asset, network, payTo, scheme and resource binding against caller policy.
7. Only after separate authorization for the target amount, call `retry_http_request_with_x402` for the original target challenge.

AgentKit also exposes `discover_x402_services` for discovery. Do not enable dynamic registration merely to bypass the service allowlist, and do not use `make_http_request_with_x402` on an unfamiliar target before Guard and caller authorization because that action combines challenge handling and payment.

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
