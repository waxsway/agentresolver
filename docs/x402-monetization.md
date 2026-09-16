# AgentResolver monetization

Last updated: 2026-09-16 UTC

AgentResolver keeps discovery free and monetizes only explicit commercial surfaces. The current strategy has two lanes: provider-funded discovery inventory and AgentResolver-owned x402 capabilities.

## Settlement

- Network: Base (`eip155:8453`)
- Asset: USDC
- Receiving address: `0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8`
- Facilitator: `https://facilitator.xpay.sh`
- Discovery remains free.
- Resolver results never authorize spending on behalf of an agent.
- A 402 challenge, crawler hit, directory probe, smoke test, or unpaid retry is not revenue.
- Revenue counts only after an independent third party pays and settlement/payment is verified.

## Commercial model

### Provider-funded discovery

Agents and crawlers can discover capabilities for free. Providers may apply for explicitly labeled, relevance-limited sponsored placement alongside matching intent. Organic ranking stays independent.

No public fixed sponsorship price is authorized. Application is inquiry-only; pricing, duration, placement, reporting, activation, and any financial commitment require operator approval.

### x402 paid capabilities

AgentResolver also exposes bounded pay-per-call capabilities over x402. These are an additional revenue lane, not evidence that every crawler or discovery request is a buyer.

Paid products should be added only when there is credible evidence of repeated agent workflow demand and the product can be served with tightly bounded cost. Prefer deterministic local compute and avoid upstream variable-cost dependencies unless separately approved.

## Funnel

1. External machine discovers AgentResolver.
2. Free discovery identifies relevant capabilities.
3. A genuinely interested caller invokes a paid route or provider-facing commercial surface.
4. Paid routes issue an x402 challenge; the caller independently decides whether to authorize payment.
5. A signed retry is verified and settled.
6. Only the successful independent settlement is counted as collected revenue.

Provider monetization is measured separately as qualified inventory, inbound inquiry, approved commercial terms, activation, and collected payment.

## Safety / cost controls

- Never require or store a private key or seed phrase on the AgentResolver server.
- Do not self-pay to manufacture revenue.
- Do not enable paid infrastructure, paid upstream APIs, or material egress without explicit approval.
- Do not put ordinary capability discovery behind a paywall.
- Keep sponsorship labeled, relevance-limited, and independent of organic ranking.
- Do not add custody, escrow, third-party payout, hidden routing spread, or payment splitting without a fresh approval/compliance review.
