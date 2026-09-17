# AgentResolver Project State

> Canonical operational handoff for future AgentResolver work.
>
> **Read this file before making material architecture, pricing, payment-rail, discovery, or revenue changes.**
> Update it after substantial work so the next chat/agent can resume from the real state instead of reconstructing history.

## State metadata

- Last updated: 2026-09-17 (America/Denver)
- Repository: `waxsway/agentresolver`
- Canonical production domain: `https://agentresolver.vercel.app`
- Public repository: **yes**
- Secrets policy: **never place wallet secrets, private keys, seed phrases, API credentials, personal email/account details, or other sensitive information in this file**
- Source-of-truth rule: production telemetry + deployed runtime + merged source beat stale documentation

## Mission

Turn AgentResolver into trusted machine-native payment infrastructure that autonomous agents:

**discover → trust → pay → use → verify → return repeatedly**

Commercial success means **independently verified external machine payments and repeat usage**, not traffic, GitHub activity, directory rankings, or HTTP 402 volume by itself.

Longer-term positioning:

**AgentResolver is authorization and trust infrastructure for autonomous payments.**

x402 is the current beachhead. Do not assume the company must remain x402-only forever.

## Non-negotiable operating rules

1. Do not spend operator funds without explicit approval.
2. Do not make self-payments.
3. Do not use operator wallet secrets/private keys.
4. Do not email, DM, apply, or submit identity-bearing forms without explicit approval.
5. Anonymous/free distribution actions are allowed when they create no spend and do not expose private information.
6. Warn before actions that could create egress or third-party spend.
7. Do not count a 402 challenge as revenue.
8. Do not count directory crawler/probe traffic as buyers.
9. Do not claim a settlement unless telemetry/on-chain evidence supports it.
10. Do not casually remove or replace existing working funnels when testing a new product.
11. Prefer branch → PR → CI → merge → guarded production deploy → canonical verification.
12. If CI fails, fix it before merge; do not weaken tests merely to make them green.
13. Before a material pivot, inspect this file and the current repo state first.
14. After substantial work, update this file with what changed, what is live, evidence, remaining blockers, and the next best action.

## Verified commercial state

### Confirmed AgentResolver revenue

- **Confirmed internal telemetry:** `$0.002 USDC`
- **Confirmed independent external settled purchases:** 2
- Both confirmed purchases were the `x402-ping` canary at `$0.001` each.
- Treat this as the revenue floor until additional settlement evidence is reconciled.

### External directory evidence

NoHumans currently reports the AgentResolver Settlement Ping as:

- `paid_verified: true`
- evidence tier: `paid_verified`
- an externally reported on-chain unique-payer count greater than AgentResolver's internally reconciled settlement count

**Important:** do not increase AgentResolver's confirmed revenue/payer count from that external aggregate alone. Reconcile against AgentResolver settlement telemetry and/or independently verifiable settlement evidence first.

## Current strategic decision

### AgentResolver Guard is additive, not a hard pivot

Do **not** throw away the existing business/funnels.

Keep:

- free capability discovery
- x402 settlement canary
- paid deterministic utilities
- verified resolve
- batch verified resolve
- x402/payment trust surfaces
- MCP discovery
- directory distribution
- execution evidence and settlement history

AgentResolver Guard is the flagship **repeat-use payment authorization layer** built on top of the existing x402 payment-preflight engine.

The market decides whether Guard deserves to become the dominant product. Measure paid behavior before making it the whole company.

## Current funnel diagnosis

Raw traffic can be misleading because automated scanners sweep many endpoints and manufacture large 402 counts.

The commercially meaningful funnel is:

**qualified caller → 402 → wallet-capable signed retry → settlement → paid fulfillment → repeat payer**

Current observed bottleneck:

**402 challenge → signed payment retry**

Recent windows have shown many valid 402 challenges but no corresponding surge in signed retries or settlements.

Optimize for funded/wallet-capable buyer behavior, not request volume.

## Current product architecture

### Proven settlement canary

- Capability: `x402-ping`
- Endpoint: `/api/x402-ping`
- Price: `$0.001 USDC`
- Supports Base and Solana
- Purpose: cheapest end-to-end test of wallet → facilitator → settlement → fulfillment
- This is a wedge/canary, not the long-term revenue engine

### Canonical pre-payment authorization engine

- Capability ID: `x402-payment-preflight`
- Canonical endpoint: `/api/x402-payment-preflight`
- Preferred low-friction method: **GET**
- POST remains supported for body-bearing compatibility
- Price: `$0.001 USDC`
- Returns fail-closed `eligible/blocked`, exact observed payment terms, reason codes, evidence receipt, and stable fingerprints

### AgentResolver Guard

- Branded alias endpoint: `/api/payment-guard`
- MCP tool: `payment_guard`
- Underlying capability ID remains `x402-payment-preflight` for compatibility
- Guard is intended to be run **before each autonomous x402 spend**
- Caller retains signer/spend authority
- AgentResolver does not receive wallet secrets or authorize the caller's target payment

### Higher-value paid handoff

Successful canary/verification flows should lead into useful paid work, including:

- `/api/verified-resolve` — higher-value single decision
- `/api/batch-verified-resolve` — higher-value batch decisions
- deterministic paid utilities

Do not optimize exclusively for `$0.001` transactions.

## Important recent work

### PR #292 — compact live x402 challenges

- Reduced live `PAYMENT-REQUIRED` payload size
- Preserved rich catalogs/OpenAPI outside the wire challenge
- Added header-size regression coverage

### PR #293 — paid GET x402 preflight

- Added GET support for `/api/x402-payment-preflight`
- Preserved POST
- Reduced integration friction

### PR #294 — GET-first machine discovery

- Fixed generated machine catalogs/OpenAPI that incorrectly hardcoded POST
- Published GET-first preflight/ping discovery while retaining POST compatibility

### PR #295 — additive AgentResolver Guard layer

- Added shared Guard decision/evidence result
- Added first-class MCP `payment_guard`
- Added `/api/payment-guard`
- Preserved canonical preflight endpoint/operation identity
- Added repeat-use buyer guidance
- Added Market402 distribution
- Fixed paid GET runtime body metadata
- Guard is additive, not a replacement for the rest of AgentResolver

### PR #297 — Guard post-deploy smoke/MCP coverage

- Fixed verification drift
- Restored `@x402/fetch` compatibility field in buyer bootstrap
- Added Guard production smoke/MCP checks
- Production Smoke and MCP preflight/Guard funnel checks turned green

### PR #299 — live Guard query discovery

- Merged source change to publish GET input/query metadata in live Bazaar/x402 discovery
- Intended live challenge fields include:
  - `url` (required)
  - `method`
  - `maxPriceUsd`
  - `expectedPayTo`
  - `expectedNetwork`
  - `allowUnpaidPostProbe`
- Keeps the live challenge under the interoperability/header-size budget
- **Verify canonical production before claiming this is live**, because release ordering briefly involved workflow-only commits after the app merge

### PR #300 — exact Guard buyer bootstrap contract

- Merged buyer bootstrap metadata for the Guard call contract:
  - method GET
  - price `$0.001`
  - required query: `url`
  - optional safety assertions
  - repeat-use policy: before each autonomous x402 spend
- This was intentionally used to place the #299 app behavior on the latest deployable main lineage
- **Verify canonical production deployment and live PAYMENT-REQUIRED metadata before calling the work complete**

## Directory/distribution state

AgentResolver has distribution/verification workflows for multiple machine-payment discovery ecosystems, including:

- Market402
- Agent402
- AgentCash
- x402dash
- NoHumans
- other x402/Bazaar discovery surfaces already present in the repo

### NoHumans

- Settlement Ping is externally marked `paid_verified`
- A Guard listing submission was accepted into the NoHumans verification queue
- At first submission, Guard was reported `unverified` pending probe streak
- NoHumans warned that the Guard listing lacked:
  - `sample_query`
  - `request_schema`
- Their response explicitly indicated those fields improve buyer usability/ranking for thin/new listings
- Next operator should prefer updating/upserting the existing Guard listing rather than creating duplicates
- Do not expose any private claim/edit token in this public file

## Telemetry and truth rules

Important events:

- `paid_capability_attempt`
- phase `challenge_request`
- phase `paid_retry`
- `paid_capability_settled`
- execution evidence events

Useful fields include:

- capability ID
- request ID
- caller hash
- user agent
- traffic classification
- payment signature presence
- settlement network
- settlement amount
- transaction/evidence references

Interpretation:

- 402 = challenge/quote, **not revenue**
- 405/204 = not revenue
- paid retry = materially stronger buyer intent
- `paid_capability_settled` = confirmed settlement evidence
- successful paid fulfillment + execution evidence = stronger proof still

## Known traffic pattern

High request counts include:

- scanners
- method sweeps
- directory probes
- OPTIONS/HEAD probes
- repeated automated callers

A single caller can generate many 402s across many endpoints in seconds.

Never present raw request count as equivalent to users, customers, or revenue opportunities.

## Current highest-priority work

Work these in order unless new telemetry shows a more valuable blocker.

### 1. Verify the latest Guard runtime contract is actually live

On canonical production verify:

- `/api/payment-guard` returns x402 402
- deployment SHA is current
- live Bazaar metadata advertises GET
- live query params/schema includes required `url` and optional policy assertions
- PAYMENT-REQUIRED header remains under interoperability size budget
- canonical `/api/x402-payment-preflight` remains compatible
- buyer bootstrap exposes the exact Guard call contract
- MCP `payment_guard` challenges without leaking paid output

### 2. Improve NoHumans Guard listing without duplicating it

If the existing listing can be safely updated without operator identity/spend:

- add `request_schema`
- add a useful `sample_query`
- preserve the existing listing ID/history
- do not publish private claim/edit credentials
- verify public discovery after update

### 3. Attack the signed-retry gap

Measure:

- qualified external 402s
- signed retries
- signed retry rejection reasons
- settlements
- repeat payer hashes

Goal: increase **402 → signed retry**, not just traffic.

### 4. Reconcile payer/revenue evidence

NoHumans' externally reported payer metrics currently exceed AgentResolver's internally confirmed settlement count.

Do not guess.

Reconcile via:

- settlement telemetry
- evidence history
- transaction references/on-chain evidence where available

Then update the verified revenue section above.

### 5. Push repeat use, not just canary purchases

A canary is naturally one-off.

The scalable behavior is:

**agent receives target 402 → calls AgentResolver Guard → evaluates evidence/policy → caller-owned wallet signs target payment → repeats on future spends**

Track whether any external caller begins repeating Guard checks.

## Revenue strategy

Near-term objective:

**first meaningful repeat paid usage**, not merely more canary settlements.

Longer-term revenue layers can include:

- per-authorization Guard calls
- higher-value verification/resolution actions
- enterprise spend policy
- organization allow/deny rules
- audit/history
- signed evidence receipts
- webhooks/SIEM/compliance integrations
- framework/wallet integration

Do not assume today's `$0.001` pricing is the final business model.

## Architecture principles

- Trust-minimized, mechanically verifiable
- Fail closed for payment authorization
- Caller controls signer and spending policy
- Never request wallet secrets
- Deterministic evidence before marketing claims
- Preserve backward compatibility when possible
- Add aliases before destructive renames
- Public discovery should be accurate and machine-readable
- Live runtime contracts must match OpenAPI/catalog contracts
- Prefer evidence graphs/history as a long-term moat
- Protocol-specific implementation should not become the permanent company identity

## Handoff protocol for every future chat/agent

At the beginning of substantial AgentResolver work:

1. Read `PROJECT_STATE.md`.
2. Inspect current `main` and recent PR/deployment state.
3. Check current production telemetry before making revenue claims.
4. Do not repeat completed work because an older chat did not know it happened.
5. If current evidence contradicts this file, trust current evidence and update this file.

Before ending substantial work:

1. Update "Verified commercial state" if settlement evidence changed.
2. Move completed items out of "Current highest-priority work".
3. Record important merged PRs/deployments.
4. Record new blockers and the next best action.
5. Keep the file concise enough to remain usable.
6. Never add secrets or private operator data.

## Definition of success

The next major milestone is **not** a larger traffic number.

It is an external machine buyer that:

1. discovers AgentResolver,
2. receives a valid x402 challenge,
3. makes an authorized signed retry,
4. settles successfully,
5. receives verifiable paid fulfillment,
6. returns and pays again.

That is the signal to optimize around.
