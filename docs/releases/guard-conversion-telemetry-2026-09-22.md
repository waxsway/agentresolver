# Production release — Guard conversion telemetry — 2026-09-22

This one-shot release publishes the already-green Guard conversion telemetry fix from PR #713.

Measured reason for release:
- production is returning repeated HTTP 400 responses on Guard/payment-preflight entry points before the normal paid-route telemetry runs;
- those early failures currently lack caller hash, user-agent classification, and traffic class;
- that prevents us from distinguishing crawler noise from agents failing the required input contract.

Release behavior:
- add the privacy-safe `payment_guard_invalid_input` event to `/api/payment-guard`;
- add the same event to `/api/x402-payment-preflight`;
- reuse the existing caller hashing and traffic classification helpers;
- log only endpoint, method, bounded reason `missing_url`, caller hash, user agent, and traffic class.

Preserved invariants:
- no target URL logging;
- no price change;
- no payment challenge change;
- no settlement behavior change;
- no payment-rail change;
- no new endpoint;
- canonical Guard remains non-custodial.

Validation before release:
- PR #713 merged at `74d46f4136fc884c7550228838d365b47dec5561`;
- GitHub Actions run `35783969603`;
- typecheck passed;
- tests passed;
- build passed;
- smoke test passed.

Production before release:
- deployment: `dpl_48Z7mBQJd2wXBvuEdYYREjs7MMRc`;
- deployed SHA: `bb7d1d132d35516f50cb584a388d54d3ba85863b`;
- accounting revenue: 18 external settlements / $0.154 USDC / $0 MRR.

Post-release verification:
- canonical production serves the validated release SHA;
- `/api/payment-guard` still returns its existing valid x402 challenge for a complete request;
- a missing-url request returns the existing 400 contract;
- runtime logs emit `payment_guard_invalid_input` for that missing-url request;
- payment and settlement telemetry remain healthy;
- watch for new paid retries and `paid_capability_settled` events.

## Release gate

AGENTRESOLVER_PRODUCTION_RELEASE_ONCE

Exactly one guarded Vercel production build is authorized by this marker.
