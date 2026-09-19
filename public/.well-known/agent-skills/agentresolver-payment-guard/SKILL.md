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


## MCP wallet-capable clients — fail-closed pre-sign gate

For `@x402/mcp`, use `onPaymentRequested` before the wallet creates a payment. The host must supply its own `hostAllowsGuardSpend(context)` policy check. Return `false` on every mismatch.

```ts
const guardToolResources = {
  payment_guard: "mcp://tool/payment_guard",
  x402_payment_preflight: "mcp://tool/x402_payment_preflight"
};

const allowedGuardRequirements = [
  {
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
  },
  {
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    payTo: "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa"
  }
];

const samePaymentIdentifier = (network, actual, expected) =>
  network.startsWith("eip155:")
    ? actual.toLowerCase() === expected.toLowerCase()
    : actual === expected;

const onPaymentRequested = async (context) => {
  if (!(await hostAllowsGuardSpend(context))) return false;

  const expectedResource = guardToolResources[context.toolName];
  if (!expectedResource) return false;
  if (context.paymentRequired.x402Version !== 2) return false;
  if (context.paymentRequired.resource.url !== expectedResource) return false;

  return context.paymentRequired.accepts.some((requirement) =>
    requirement.scheme === "exact" &&
    requirement.amount === "1000" &&
    allowedGuardRequirements.some((expected) =>
      requirement.network === expected.network &&
      samePaymentIdentifier(requirement.network, requirement.asset, expected.asset) &&
      samePaymentIdentifier(requirement.network, requirement.payTo, expected.payTo)
    )
  );
};
```

For EVM identifiers, address equality is case-insensitive. For Solana, Base58 asset and `payTo` identifiers are case-sensitive and must match exactly. This callback authorizes only the separate $0.001 AgentResolver Guard fee after the host policy has approved it; it does not authorize the target payment.

For HTTP clients, the free buyer setup exposes equivalent pre-sign gates: `paymentRequirementsSelector` for `@x402/fetch` and `@x402/axios`, and client policies plus `on_before_payment_creation` / `AbortResult` for Python `x402HttpxClient`.


## Cloudflare Agents SDK — native x402 MCP

Cloudflare Agents has a native x402 v2 MCP client. Keep the signer inside the caller-controlled Cloudflare runtime and use AgentResolver only as the paid verification service.

- Connect the AgentResolver MCP server at `https://agentresolver.vercel.app/mcp`, then wrap that MCP connection with `withX402Client` from `agents/x402`.
- For AgentResolver on Base, prefer CAIP-2 network `eip155:8453`. The caller must still enforce its own allowed network, asset, payTo and budget.
- Invoke Guard with `x402Client.callTool(onPaymentRequired, { name: "payment_guard", ... })`. Pass a **non-null** `onPaymentRequired` callback; passing `null` enables automatic payment and must not be used for an unfamiliar Guard or target spend.
- In `onPaymentRequired`, authorize only the separate **$0.001 Guard fee** when the selected requirement matches caller policy. The v2 retry uses `PAYMENT-SIGNATURE`.
- Require `decision === "eligible"` and verify the target amount, asset, network, payTo, scheme and resource binding.
- Require a second, separate authorization before the original target payment. Guard eligibility never authorizes that spend.

## OpenAI Agents SDK — approval-gated signed retry

For OpenAI Agents SDK hosts, use AgentResolver's remote MCP only for discovery/tool access and keep x402 signing in a **caller-controlled** payment tool or self-hosted x402 MCP client that owns the caller's signer.

- JavaScript: `@openai/agents`; mark the x402 execution function tool with `needsApproval`. For hosted MCP, keep `requireApproval: "always"` and handle `onApproval`.
- Python: `openai-agents`; mark the x402 execution function tool with `needs_approval`. For hosted MCP use `require_approval` / `on_approval_request`; for local MCP use `require_approval` and pre-approval input guardrails where appropriate.
- Hosted MCP approval is **not** an x402 signer. The signer remains outside AgentResolver and outside the hosted MCP approval callback.
- First obtain the Guard 402 without paying. Only after the caller's policy approves the separate **$0.001 Guard fee** may the caller-controlled payment tool create the signed retry with `PAYMENT-SIGNATURE`.
- Require the paid Guard response to return `decision === "eligible"` and verify amount, asset, network, payTo, scheme, and resource binding against caller policy.
- Require a **second, independent approval** before signing the original target payment. Guard eligibility never authorizes that target spend.
- Fail closed if the runtime cannot enforce approval before the payment tool creates or sends `PAYMENT-SIGNATURE`.

The full machine-readable OpenAI Agents SDK handoff is also available from:
`https://agentresolver.vercel.app/api/x402-client-setup`

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
