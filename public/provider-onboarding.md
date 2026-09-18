# AgentResolver provider onboarding

AgentResolver provider onboarding is machine-native and fail-closed.

## Paid launch check

Buy `POST /api/provider-launch-check` for **$0.05 USDC** through x402 on Base or Solana.

The paid result checks current technical readiness and the provider's x402 contract, then returns a bounded `registryEntry` when the provider is technically ready for review.

Required fields include provider/capability identifiers, origin, endpoint, price, and network. POST-only providers must also expose a safe GET `probeUrl` representing the same x402 payment contract; AgentResolver never performs an unsolicited unpaid POST during onboarding.

## Registry submission

Add the returned `registryEntry` to `config/provider-partners.json` in a pull request to `waxsway/agentresolver`.

Retain the launch check's x402 `PAYMENT-RESPONSE` as settlement evidence.

Paying for the launch check does not buy ranking, guarantee activation, or verify legal identity. Provider activation remains reviewed.

## Routed demand

Approved routes are exposed through `/api/providers`, free `/api/resolve`, and MCP resolution. `/api/execute` creates an attribution ID and returns a direct provider handoff. AgentResolver never holds buyer wallet keys or authorizes target spend.

## Provider-funded attribution

The current pilot success fee is **$0.001 USDC** after a provider reports an attributed request as fulfilled or a qualified lead.

Settle through `POST /api/provider-attribution-settle`.

A successful fee settlement proves that the provider paid AgentResolver's attribution fee. It does not independently prove the underlying buyer transaction or fulfillment.
