# Production Release — Bazaar discovery and buyer contracts — 2026-09-20

This one-shot release batches all application drift since production SHA
`34c5596c8918a5e20a5baeb562398b0bf08cc4aa`.

## Revenue-linked reason to release

Real external 402 Atlas settlements successfully paid and received fulfillment while the facilitator rejected AgentResolver's Bazaar discovery extension:

`Bazaar extension validation failed: Invalid input at info.input`

The staged fix makes paid GET/HEAD and POST routes publish method-correct Bazaar input contracts, preserving one x402 server/facilitator per capability.

## Included application changes

- AgentCore Payments/x402 v2 compatibility documentation and inbound discovery wording.
- Verified Resolve POST contract aligned across runtime discovery and OpenAPI with nested `constraints`.
- Verified Resolve paid GET compatibility preserved with flattened query fields.
- Paid-preflight wallet integration recipe exposed machine-readably.
- Bazaar method-shape fix for helper-backed dual-method paid routes.
- Same Bazaar fix for custom Verified Resolve paid GET + POST.
- Searchable Bazaar serviceName/tags for Verified Resolve and Batch Verified Resolve.
- Regression coverage using upstream Bazaar spec validation.

## Explicit non-changes

- no price changes;
- no payTo changes;
- no facilitator changes;
- no new custody;
- no caller wallet/key access;
- no automatic target spending;
- no subscription/billing change;
- no new outreach;
- no self-payment.

## Pre-release validation

PR #637 final CI passed:
- typecheck
- full tests
- build
- built-app smoke

Release PR CI must pass again before merge.

## Post-release proof target

After production:
1. canonical SHA converges to this release;
2. ordinary payment/trust/procurement smoke remains green;
3. Bazaar-facing GET/POST challenges are method-correct;
4. next independent paid POST settlement should no longer report Bazaar `rejected`;
5. ideally facilitator reports catalog success/processing and the resource becomes searchable.

Do not count deployment or catalog probes as revenue.
