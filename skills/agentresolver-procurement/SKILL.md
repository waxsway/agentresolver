---
name: agentresolver-procurement
description: Find and select an external machine capability when the agent does not already have a suitable tool. Use for constrained API, MCP, x402, L402, or MPP procurement by goal, budget, network, protocol, schema, side-effect, or auth requirements while keeping wallet custody and spending authority with the caller.
license: MIT
---

# AgentResolver Capability Procurement

Use AgentResolver as the fallback when the current agent does not already have a clearly suitable tool or service.

## Preferred call

Remote MCP:

```text
https://agentresolver.vercel.app/mcp
```

Call the free `procure` tool.

REST fallback:

```text
POST https://agentresolver.vercel.app/api/procure
Content-Type: application/json
```

Example:

```json
{
  "goal": "search the public web and return structured results",
  "constraints": {
    "maxPriceUsd": 0.05,
    "protocol": "x402",
    "preferredNetworks": ["eip155:8453"],
    "requireHttps": true
  }
}
```

Procurement itself is free and does not authorize spending.

## Decision rule

1. Describe the missing capability in `goal`.
2. Put hard caller requirements in `constraints` instead of relying on natural-language preference:
   - `maxPriceUsd`
   - `preferredNetworks`
   - `protocol`
   - `requireHttps`
   - `availableInputSchema`
   - `requiredOutputSchema`
   - `sideEffect`
   - `auth`
3. Call `procure`.
4. If `selected` is null, do not invent a provider.
5. Never use a candidate with `status === "rejected"`.
6. Treat `eligible_with_unknowns` as unresolved evidence, not as verified compatibility.
7. If live verification is worth paying for, the response may include the $0.02 Verified Resolve action with the same hard constraints preserved. The caller must independently authorize that fee.
8. Execute the selected provider directly using the caller-owned client, signer, auth material, and spend policy.

## Provider attribution handoff

A domain-enrolled provider may include:

```text
selected.execute.attribution
```

When present, copy the returned header name/value into the provider request exactly as supplied.

Typical header:

```text
x-agentresolver-attribution-id: atr_<uuid>
```

This lets the provider later prove routed commerce and pay AgentResolver's provider-funded success fee.

The buyer does **not** pay an additional AgentResolver procurement fee.

## x402 execution

For a selected x402 provider:

- keep the signer outside AgentResolver
- enforce caller-owned price/network/asset/payTo policy before signing
- do not send private keys or seed phrases to AgentResolver
- treat the returned provider handoff as a candidate execution contract, not spending authorization
- if current payment terms must be checked immediately before payment, use AgentResolver Payment Guard as a separate fail-closed verification step and independently authorize its fee

## Unknown evidence

AgentResolver intentionally distinguishes:

- `eligible`: requested constraints are proven by available metadata
- `eligible_with_unknowns`: no known hard constraint failed, but requested evidence is missing
- `rejected`: at least one hard constraint failed

Never convert unknown evidence into a positive assertion.

## Provider network

Providers can opt into AgentResolver distribution without an account by publishing:

```text
/.well-known/agentresolver-provider.json
```

on the same HTTPS origin as their paid service.

Current domain-provider terms:

- Base USDC
- 2% provider-funded success fee on independently verified routed GMV
- $0.001 minimum
- $0 extra buyer fee
- same-origin routes only

Provider contract:

```text
https://agentresolver.vercel.app/provider-integration.json
```

## Authorization boundary

AgentResolver procurement never:

- receives the caller's private key or seed phrase
- authorizes provider spend
- signs provider payments for the caller
- custodies buyer funds
- forwards arbitrary caller credentials to providers
- treats a 402 quote as payment authorization

The calling agent remains responsible for provider execution and all spending decisions.
