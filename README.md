# AgentResolver Guard

**AgentResolver Guard is a pre-sign safety check for autonomous x402 payments.**

An agent is about to pay an unfamiliar or changed x402 endpoint. Before the target wallet signs, Guard reads the target's live payment challenge, validates the payment contract, and returns a fail-closed decision plus evidence the caller can bind to its own policy.

**Production:** https://agentresolver.vercel.app

## What Guard checks

Guard performs one bounded HTTPS preflight against the target and verifies the live x402 contract before the caller authorizes spend:

- endpoint reachability and HTTPS/TLS evidence
- `PAYMENT-REQUIRED` structure
- x402 version and payment scheme
- quoted USDC amount
- optional `maxPriceUsd` ceiling
- network
- asset
- `payTo` recipient
- optional `expectedPayTo` and `expectedNetwork` assertions
- resource/payment binding
- stable evidence fingerprints for change detection

Guard blocks private/reserved network targets, does not follow redirects, uses bounded timeouts, and fails closed when required evidence is missing or mismatched.

Guard **never receives the target-payment private key, signs the target payment, authorizes the target spend, or custodies/forwards target funds.** The calling runtime keeps spending authority.

## Price

Canonical Guard:

```text
POST or GET https://agentresolver.vercel.app/api/x402-payment-preflight
$0.001 USDC per successful Guard check
Base or Solana where advertised
```

The compatibility alias `/api/payment-guard` uses the same Guard product. A Coinbase-CDP-specific Base route is available at `/api/cdp-payment-guard` for **$0.002 USDC** because that rail has a higher observed settlement floor.

## The intended transaction path

```text
target request
  -> target returns 402
  -> AgentResolver Guard
  -> validate amount / asset / network / payTo / scheme / resource binding
  -> Guard returns eligible or blocked + evidence
  -> caller policy decides
  -> caller-owned wallet may sign the target payment
```

Guard is evidence for a payment decision, not permission to spend.

## Install as a pre-sign hook

The official x402 client exposes `onBeforePaymentCreation`. Use **two x402 clients**: one hooked client for the target payment and one hook-free client dedicated to the separate Guard payment. This prevents recursive Guard payments.

The framework-neutral client package now exports the reusable pre-sign hook directly:

```ts
import { createAgentResolverX402GuardHook } from "agentresolver-client";

targetClient.onBeforePaymentCreation(
  createAgentResolverX402GuardHook({
    maxTargetPriceUsd: 0.05,
    guardFetch // separate payment-enabled fetch used only for the Guard fee
  })
);
```

Until registry publication, build `packages/agentresolver-client` directly from this repository. The hook fails closed and binds AgentResolver evidence back to the exact selected scheme, network, asset, amount, payee, x402 version, and resource before the x402 client can proceed to signing.

Three maintained integration guides:

- [x402 core pre-sign Guard](docs/integrations/x402-core-payment-guard.md)
- [Coinbase CDP SDK payment Guard](docs/integrations/coinbase-cdp-sdk-payment-guard.md)
- [Thirdweb x402 payment Guard](docs/integrations/thirdweb-x402-payment-guard.md)
- [Zero-dependency wallet/proxy Guard](docs/integrations/zero-dependency-payment-guard.md)

## Install as an Agent Skill

```bash
npx skills add waxsway/agentresolver --skill agentresolver-payment-guard
```

Direct skill source:

```text
https://agentresolver.vercel.app/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md
```

The skill tells a wallet-capable agent to run Guard before each unfamiliar or changed autonomous x402 spend.

## Example Guard request

Guard supports a target URL plus optional caller assertions:

```json
{
  "url": "https://target.example/api",
  "method": "GET",
  "maxPriceUsd": 1.00,
  "expectedPayTo": "0x...",
  "expectedNetwork": "eip155:8453"
}
```

The unpaid request returns AgentResolver's own x402 challenge. After the caller authorizes and settles the Guard fee, the response contains the observed target-payment terms, reason codes, eligibility decision, and evidence receipt.

## What Guard is — and is not

Guard is a **transaction-path control** for x402 buyers. It is designed to answer a narrow question immediately before signing:

> Does the live payment challenge still match the payment contract my agent is willing to authorize?

Guard does not claim that a provider is honest, that a wallet has a particular legal owner, or that future fulfillment is guaranteed. It validates live payment-contract evidence and caller-supplied policy assertions.

Wallet-risk, reputation, AML, and other third-party evidence can be added later through explicit evidence-provider interfaces if real users require them. They are not bundled into Guard by default.

## Supporting infrastructure

AgentResolver still exposes supporting infrastructure used by integrations, testing, and open-world fallback workflows. These surfaces are **not the primary product**:

- free `procure` / `resolve` capability discovery
- remote MCP control plane: `https://agentresolver.vercel.app/mcp/control`
- x402 settlement canaries and compatibility routes
- machine-readable manifests, OpenAPI, skills, and discovery metadata
- legacy deterministic utilities retained for compatibility and evidence

New utility endpoints, passive directory submissions, and speculative marketplace-specific builds are not product strategy. Guard is the product; supporting infrastructure exists to help agents reach and use it safely.

## Machine-readable surfaces

```text
https://agentresolver.vercel.app/.well-known/x402
https://agentresolver.vercel.app/openapi.json
https://agentresolver.vercel.app/llms.txt
https://agentresolver.vercel.app/.well-known/agentresolver-trust.json
```

## Security

AgentResolver is non-custodial. Never provide it with wallet private keys or seed phrases.

Please report vulnerabilities privately through this repository's GitHub Security Advisories. The production security contact is also published at:

```text
https://agentresolver.vercel.app/.well-known/security.txt
```

## Local development

```bash
npm install
npm run dev
```

## License

MIT
