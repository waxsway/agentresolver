# Production release — Bazaar discovery + Payment Preflight manifest — 2026-09-20

This release candidate batches the production-relevant work accumulated after the strict-client compatibility release.

Included behavior:
- fixes the paid-settlement Bazaar rejection observed on real Atlas settlements (`Invalid input at info.input`);
- publishes method-correct Bazaar discovery for GET/HEAD vs POST paid routes;
- keeps Verified Resolve POST discovery aligned with its actual nested constraints body;
- adds searchable service metadata to commercially important custom routes;
- explicitly publishes `POST /api/x402-payment-preflight` in `/.well-known/x402` so external routers can discover the core verify-before-pay product;
- adds a regression test that prevents Payment Preflight from silently disappearing from the public x402 manifest.

Also present on current main:
- documentation/inbound interoperability updates;
- zero-spend directory registration workflows and their audit-status corrections.

Those distribution workflows do not alter production runtime behavior unless their own path is changed again.

## Evidence

- Real external Atlas payments settled successfully before this release, but the facilitator logged Bazaar discovery rejection on the same paid requests.
- Agent402's current seller router reads seller manifests and ranks by task match, health, then price.
- Before this batch, the live AgentResolver manifest described Payment Preflight at top level but omitted it from the `resources` array.

## Release gate

AGENTRESOLVER_PRODUCTION_RELEASE_ONCE

This marker authorizes the guarded production workflow only if this pull request is explicitly merged by the owner/operator after approval.

Do not auto-merge.
Do not merge merely because CI passes.
No additional paid service or wallet action is authorized by this document.
