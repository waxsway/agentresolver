# AgentResolver Demand Status

Last updated: 2026-09-16 UTC

This ledger separates machine discovery traffic from actual commercial demand and revenue. It intentionally excludes raw IP addresses and raw goal text.

## Verified state

- Production resolver, MCP server, and x402 payment challenges are live.
- Historical external MCP `resolve` use has been observed.
- Traffic is classified as `internal_test`, `directory_probe`, `liveness_crawler`, `agent_discovery`, `qualified_intent`, or `paid_retry` before it is interpreted commercially.
- Provider-funded discovery inventory is exposed through the provider page, sponsorship API/manifest, resolver surfaces, and MCP `sponsorship_info`.
- Sponsorship has no public fixed rate. Any commercial terms require operator approval.
- **Verified independent third-party revenue: $0.**
- **Verified independent settlements: 0.**

## Measurement rules

1. Do not count health checks, deployment smoke, server-card fetches, MCP initialization, `tools/list`, directory probes, or crawler requests as buyer demand.
2. A 402 challenge is not revenue.
3. A valid external `tools/call`, resolver goal, or paid-route POST can indicate qualified intent, but it is not revenue unless an independent caller signs and settlement succeeds.
4. Revenue counts only after an independent third-party settlement/payment is verified.
5. Use one-way caller hashes for repeat-caller measurement; never publish raw IPs or raw goal text.
6. Keep provider/sponsor inquiries separate from traffic and payment metrics.

## Current commercial milestones

- [x] Production resolver and MCP server live.
- [x] Official MCP Registry listing published.
- [x] External machine discovery and historical resolver use observed.
- [x] Provider-funded sponsorship inventory and inquiry-only intake published.
- [x] Paid-route traffic classification separates probes from commercial intent.
- [ ] First independent signed paid retry.
- [ ] First independent verified settlement / dollar collected.
- [ ] First qualified provider/sponsor inquiry.
- [ ] $1,000 collected revenue.
- [ ] $5,000 collected revenue.

The operating priority is transaction #1 and evidence-backed provider monetization, not raw request volume.
