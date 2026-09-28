# AgentResolver x402 Reliability Router

AgentResolver exposes the standard x402 facilitator surface at the production origin:

```text
GET  https://agentresolver.vercel.app/supported
POST https://agentresolver.vercel.app/verify
POST https://agentresolver.vercel.app/settle
```

For x402 SDKs that accept a facilitator base URL, use:

```text
https://agentresolver.vercel.app
```

Example with the official JavaScript server client:

```ts
import { HTTPFacilitatorClient } from "@x402/core/server";

const facilitator = new HTTPFacilitatorClient({
  url: "https://agentresolver.vercel.app",
  timeoutMs: 10_000
});
```

## Safety model

AgentResolver is a non-custodial router. It never receives a merchant or buyer private key and does not replace the merchant's `payTo` address.

- `/verify` is read-only. AgentResolver may use an explicitly configured secondary verifier when the primary verification facilitator is unavailable.
- `/settle` is state-changing. AgentResolver submits a settlement to exactly one upstream facilitator. It does **not** automatically retry or fail over after a timeout or upstream 5xx because the payment may already have committed.
- If settlement state is ambiguous, AgentResolver returns `settlement_state_indeterminate` and `x-agentresolver-settlement-retry-safe: false`.
- Malformed or unsupported requests are rejected before reaching an upstream facilitator.
- Initial production routing is limited to Base and Solana.

## Why use the router?

The immediate value is transaction-path observability without changing the buyer payment contract. AgentResolver records bounded metadata for routed verify/settle activity, including a one-way request fingerprint, network, upstream outcome, and transaction fingerprint when settlement succeeds. It does not log payment signatures or private keys.

This provides the measurement layer for the next reliability features: upstream health, verified-safe routing choices, merchant-level transaction diagnostics, and paid operational monitoring.

## Current upstream policy

The production primary defaults to the same PayAI facilitator AgentResolver already uses for its own x402 products.

Optional configuration:

```text
AGENTRESOLVER_ROUTER_PRIMARY_URL=https://facilitator.example
AGENTRESOLVER_ROUTER_VERIFY_SECONDARY_URL=https://secondary.example
```

The secondary URL is **verify-only**. It is never used as an automatic settlement failover.
