# Consolidated release candidate — 2026-09-23

This release candidate intentionally consolidates the currently merged-but-not-deployed conversion work into one guarded production release.

Included since canonical production `3656ba2599e02e8a5a0887128f87b3f36b33c8e3`:

## Sales conversion surface
- `/mcp-sprint` fixed-price implementation page
- homepage CTA for API companies
- locked terms: $1,000 total / $500 start / $500 handoff / up to five existing API operations
- buyer owns delivered code
- one revision
- no traffic or revenue guarantee

## Embedded x402 Guard client
- `agentresolver-client` v0.2.0 source
- `createAgentResolverX402GuardHook(...)`
- separate hook-free `guardFetch` to avoid recursive Guard payment
- fail-closed evidence binding across scheme, network, asset, amount, payTo, x402 version, and resource
- no wallet custody and no target-spend authorization
- public README import example

## Revenue/accounting truth at preparation
- 18 independently verified external settlements
- 118000 atomic Base USDC = $0.118 USDC
- $0 MRR

## Release discipline
This file stages the release only. Production remains unchanged until the owner explicitly authorizes merge of the one-shot production release PR.
