# AgentResolver Demand Status

Last updated: 2026-09-15 UTC

This ledger separates machine discovery traffic from actual resolver usage. It intentionally excludes raw IP addresses and raw goal text.

## Verified milestones

- **External MCP `resolve` use observed:** 2026-09-15 14:39 UTC.
- A Deno-based external client completed two full MCP sessions: `initialize` → `notifications/initialized` → `tools/list` → `tools/call` for `resolve`.
- Both resolver calls returned successful HTTP 200 responses and non-empty owned/marketplace result groups.
- These calls are materially stronger evidence than crawler handshakes or `tools/list`, but they do **not** by themselves prove a unique human user, provider conversion, or revenue.

## Measurement rules

1. Do not count health checks, server-card fetches, MCP initialization, or `tools/list` as resolver users.
2. Treat an actual `tools/call` for `resolve` or a valid `POST /api/resolve` as resolver usage.
3. Use one-way caller hashes for repeat-caller measurement; never publish raw IPs.
4. Use hashed goals and coarse intent tags for demand analysis; never write raw goals to application logs.
5. Keep deployment/smoke-test traffic separate from unaffiliated external demand.

## Revenue milestones

- [x] Production resolver and MCP server live.
- [x] Official MCP Registry listing published.
- [x] External MCP `resolve` calls observed.
- [x] Founding Provider offer exists at `$250/month` with organic inclusion preserved.
- [ ] Three repeat external callers identified.
- [ ] First attributable provider referral.
- [ ] First paid Founding Provider.
- [ ] Repeatable provider acquisition motion established.
- [ ] `$10,000 MRR` reached.
