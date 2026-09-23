# agentresolver-client

Framework-neutral client for AgentResolver's non-custodial capability procurement and pre-sign x402 Guard.

AgentResolver does **not** receive a wallet, private key, API key, or authority to spend. The client can either:
- ask AgentResolver to find/evaluate machine services under explicit constraints; or
- install AgentResolver as a fail-closed pre-sign check before an x402 client creates the merchant payment payload.

## Before registry publication

The publish-ready package source lives in `packages/agentresolver-client`. Build it directly from a checkout until an npm package is published:

```bash
git clone https://github.com/waxsway/agentresolver.git
cd agentresolver/packages/agentresolver-client
npm run build
```

## Embedded x402 Guard

The client exports `createAgentResolverX402GuardHook(...)`, a structural hook compatible with the official x402 client's `onBeforePaymentCreation` lifecycle.

The host supplies a **separate payment-enabled fetch** used only to pay AgentResolver's $0.001 Guard fee. Do not pass the merchant's guarded fetch back into the hook or the Guard payment can recurse into itself.

```ts
import { createAgentResolverX402GuardHook } from "agentresolver-client";

const guardHook = createAgentResolverX402GuardHook({
  maxTargetPriceUsd: 0.05,

  // Must be payment-enabled for AgentResolver Guard and must NOT have
  // guardHook installed on it.
  guardFetch
});

targetClient.onBeforePaymentCreation(guardHook);
```

For each GET-first merchant payment, the hook:
1. extracts the exact resource selected by the x402 client;
2. pays AgentResolver Guard through the separate `guardFetch`;
3. requests a live pre-sign verification using the selected network/payee and caller budget;
4. requires an `eligible` decision;
5. binds the returned evidence back to the exact selected scheme, network, asset, amount, payee, x402 version, and resource;
6. returns `{ abort: true, reason }` on any mismatch or Guard outage.

Returning successfully does **not** authorize the merchant payment. The host's wallet, spend controls, and x402 client still decide whether to sign.

The embedded hook is deliberately GET-only. For POST or other side-effecting targets, use AgentResolver's explicit request-scoped Guard flow so the caller can retain the exact method/body and consciously decide whether an unpaid probe is safe.

## Procurement use

```ts
import { createAgentResolverClient } from "agentresolver-client";

const resolver = createAgentResolverClient();

const procurement = await resolver.procure({
  goal: "search the public web and return structured results",
  providerOrigins: ["https://provider.example"],
  constraints: {
    maxPriceUsd: 0.05,
    protocol: "x402",
    preferredNetworks: ["eip155:8453"],
    requireHttps: true,
    availableInputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"]
    }
  }
});

if (!procurement.selected) {
  throw new Error("No compatible capability found");
}

console.log(procurement.selected.execute);
```

## Integration model

Use AgentResolver when the agent does not already have a clearly suitable tool:

1. Declare the capability needed and hard constraints.
2. Call `procure(...)`.
3. Reject candidates that fail budget/network/schema requirements.
4. Treat `eligible_with_unknowns` as unresolved evidence, not as approval.
5. If the returned paid verification action is useful, authorize it only under your own wallet/spend policy.
6. Execute the selected provider directly.

For x402 payments, install the embedded Guard hook on the merchant-payment client and keep a second, hook-free payment client/fetch for the AgentResolver fee.

This preserves caller custody while making Guard part of the transaction path instead of an optional manual lookup.

Provider operators can first call `POST /api/provider-bootstrap` with their HTTPS origin. AgentResolver verifies the fixed well-known manifest and live x402 payment identity, then returns the `providerOrigins` seed plus caller-owned durable discovery registration handoffs. AgentResolver does not persist the provider or send the external registration itself.
