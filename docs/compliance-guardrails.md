# AgentResolver compliance guardrails

Last reviewed: 2026-09-15

These are product/engineering guardrails, not legal advice.

## Current commercial model

AgentResolver sells its own machine-readable software capabilities. Discovery remains free. A paid endpoint may require an x402 payment for AgentResolver's own service before execution.

## Hard guardrails

- Never take custody of customer funds for later forwarding.
- Never accept payment on behalf of an unrelated provider unless a compliant marketplace/payment structure has been reviewed first.
- Never act as an exchange, mixer, remittance service, wallet custodian, or general-purpose money transmitter.
- Never promise investment returns, token appreciation, or financial yield.
- Never hide sponsorship, paid placement, or commercial ranking incentives.
- Never let payment override relevance or safety requirements in resolver results.
- Never authorize spending for an agent. The calling agent/user must authorize its own payment.
- Do not request or store seed phrases or private keys.
- Do not knowingly facilitate sanctioned parties, restricted jurisdictions, illegal goods/services, fraud, ransomware, money laundering, terrorist financing, or other prohibited activity.
- Do not collect raw goal text, IP addresses, or unnecessary personal data when privacy-safe telemetry is sufficient.

## Payment design

- Keep free discovery separate from paid execution.
- Price and payment asset/network must be machine-readable before payment.
- Paid execution should return a standard x402 challenge when unpaid.
- Payment destination is a seller-controlled public receiving address; AgentResolver does not need the seller's private key.
- Record only the minimum transaction metadata needed for operations, reconciliation, abuse prevention, accounting, and support.
- Do not add a platform fee, split payment, escrow, provider payout, or resale flow without a fresh compliance review.

## Provider marketplace boundary

Organic provider discovery can remain free. If provider monetization is added, prefer clearly disclosed advertising/listing products that do not custody or transmit buyer funds. Any future routing commission, payment split, or provider settlement feature is an approval gate because it can materially change regulatory obligations.

## Taxes and records

Treat paid capability receipts as business revenue records. Preserve sufficient transaction and pricing records for accounting/tax reporting. Do not characterize USDC receipts as tax-free or outside normal reporting obligations.

## Sources to re-check before material payment changes

- FinCEN guidance and administrative rulings on money transmission and payments integral to a seller's own goods/services.
- Circle USDC Terms and Acceptable Use Policy, including sanctions and prohibited transactions.
- The selected x402 facilitator's current terms, supported jurisdictions, fees, settlement behavior, and KYC/KYB requirements.
- Applicable state/federal tax and business-registration requirements as revenue becomes material.

## Approval gates

Before shipping any of the following, stop and review current requirements: custody, escrow, payment splitting, third-party provider payouts, fiat conversion for users, subscription auto-debits, regulated financial services, geographic expansion with jurisdiction-specific restrictions, or any facilitator change that introduces fees.