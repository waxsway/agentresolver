# Production release — Agent402 Guard lexical conversion — 2026-09-21

This one-shot release publishes the already-green exact-intent AgentResolver Guard discovery resources.

Measured reason for release:
- Agent402 external route query `verify x402 payment before paying` currently ranks AgentResolver #2.
- AgentResolver and Delx tie on lexical score (35) and health (1).
- AgentResolver is cheaper ($0.001 vs $0.005).
- Delx wins the next tiebreak through stronger Bazaar 30-day payer history.
- AgentResolver already ranks #1 for three adjacent payment-gate intents and those routes are live, callable, and actively probed.

Release behavior:
- publish GET and POST `/api/payment-guard` as x402 manifest resources named `Verify x402 Payment Before Paying`;
- bind their advertised resource URLs to the Guard alias;
- preserve canonical Payment Preflight identity and all runtime payment behavior.

No changes to:
- price;
- payTo;
- facilitator;
- payment runtime or route handlers;
- custody/signing/spend authorization;
- settlement logic.

Production before release:
- deployment: `dpl_8mhtvteY9ZwKkg86HsiQnh3jcAKC`
- SHA: `aced1d6bd78c3c2634146266dde2714c07fbd98b`
- verified revenue: 5 external settlements / $0.005 USDC / $0 MRR.

## Release gate

AGENTRESOLVER_PRODUCTION_RELEASE_ONCE

This is one batched, measured production build. After deployment, re-check canonical production, Agent402 exact-intent rank, live signed retries, and settlement telemetry before any further release.
