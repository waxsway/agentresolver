# Provider onboarding

AgentResolver provider onboarding is machine-native and fail-closed.

## 1. Buy the launch check

POST `/api/provider-launch-check` is a paid x402 check for sellers that want AgentResolver distribution.

The launch check validates:

- provider discovery readiness;
- HTTPS/TLS and endpoint safety;
- x402 v2 PAYMENT-REQUIRED parsing;
- exact payment scheme;
- declared network;
- declared price;
- a bounded registry packet.

For a POST-only paid capability, provide a safe public GET `probeUrl` that exposes the same x402 price/network contract without side effects.

## 2. Submit the generated registry packet

A successful paid result returns `registryEntry`. For automated admission proof, settle the launch check on Base, extract its transaction hash from `PAYMENT-RESPONSE`, replace the `registryEntry.launchProof.txHash` placeholder, then add that exact object to:

`config/provider-partners.json`

through a pull request. Registry CI independently verifies the exact 50000-atomic-USDC transfer to AgentResolver before operator review.

Provider activation remains reviewed. A paid check does not buy ranking, guarantee listing, or verify legal identity.

## 3. AgentResolver routes attributed demand

Approved routes appear through `/api/providers`, free `/api/resolve`, and MCP resolution.

AgentResolver creates an `atr_...` attribution ID and returns a direct non-custodial handoff. The caller retains sole spending authority.

## 4. Provider-funded success fee

After a provider reports an attributed request as fulfilled or a qualified lead, it settles the current pilot attribution fee through:

`POST /api/provider-attribution-settle`

A successful fee settlement proves the provider paid AgentResolver's attribution fee. It does not independently prove the underlying buyer transaction or fulfillment.
