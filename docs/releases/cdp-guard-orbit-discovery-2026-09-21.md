# Production release — publish Coinbase CDP Guard in x402 discovery — 2026-09-21

## Why this release is justified

The live Coinbase-CDP Guard is healthy and externally verified, but the canonical public `/.well-known/x402` manifest does not advertise `/api/cdp-payment-guard`.

That omission creates a measured buyer-distribution defect:
- Xpay/Cursor uses OrbitX402 as its primary x402 discovery source.
- Orbit already indexes AgentResolver, but its current AgentResolver resource snapshot does not contain the CDP Guard.
- Orbit's public source confirms its server probe refresh reads `/.well-known/x402` and writes discovered resources.
- A direct Orbit buyer-intent query returned zero AgentResolver results even though PayAI fallback already contains AgentResolver Settlement Ping.
- Coinbase Bazaar remains at zero AgentResolver resources, so a genuine extension-bearing CDP Guard settlement is still the valuable indexing event.

This release changes discovery only. It does not change payment settlement logic, custody, pricing, payout address, or caller spending authority.

## Batched change

- Generate a distinct `cdp-payment-guard` service entry in the public x402 manifest.
- Generate a GET-first `/api/cdp-payment-guard` resource with the actual live contract:
  - $0.002 USDC
  - Base only (`eip155:8453`)
  - exact scheme
  - canonical Base USDC asset
  - canonical AgentResolver payTo
  - Coinbase CDP facilitator metadata
  - existing Payment Preflight input schema
- Preserve the resource through public-catalog compaction.
- Add a regression test so the CDP Guard cannot silently disappear from `/.well-known/x402` again.

After production converges, re-run Orbit's anonymous `POST /api/servers/probe` refresh and verify:
1. Orbit server detail contains `cdp-payment-guard`;
2. Xpay-compatible Orbit discovery can surface AgentResolver for verify-before-pay intent;
3. no runtime payment contract regressed.

## Release gate

AGENTRESOLVER_PRODUCTION_RELEASE_ONCE

This marker authorizes exactly one guarded production build/deploy for this merged PR after CI passes.

No user funds are spent. No self-payment is authorized. No new payment rail is enabled. No outreach or identity-bearing action is included.
