# Coinbase CDP SDK + AgentResolver Guard

Use AgentResolver as a dynamic, fail-closed payment-contract check immediately before a Coinbase CDP-managed wallet creates an x402 payment.

This composes two different controls:

- **Coinbase CDP SDK spend controls** — local caps, network/asset/payee policy, and cumulative-spend accounting.
- **AgentResolver Guard** — a fresh live check of the merchant's x402 challenge: scheme, network, asset, amount, `payTo`, and resource binding.

AgentResolver never receives the CDP wallet secret or signs the target payment.

## Why this fits CDP SDK cleanly

`CdpX402Client` extends the official `@x402/core` `x402Client`, so it exposes the stable `onBeforePaymentCreation` lifecycle hook.

CDP's own spend-control implementation also uses that hook and deliberately keeps its guardrail hook last when later hooks are registered. That means a dynamic AgentResolver check can run before the SDK's final local spend-cap enforcement rather than replacing it.

## Use two CDP x402 clients

Do not use the same hooked client to pay AgentResolver Guard.

If the Guard payment used the target client, the Guard's own 402 would trigger the AgentResolver hook recursively.

Use:

1. a **target client** with the AgentResolver hook installed;
2. a separate **Guard client** with no AgentResolver hook, restricted by CDP spend controls to AgentResolver's own Base USDC payment identity.

Both clients may intentionally use the same named CDP wallet. The wallet and signing authority remain in CDP.

## Base / GET-first example

Install the CDP SDK plus the official x402 fetch client:

```bash
npm install @coinbase/cdp-sdk @x402/core @x402/evm @x402/fetch
```

Set the normal CDP credentials in the host environment:

```text
CDP_API_KEY_ID
CDP_API_KEY_SECRET
CDP_WALLET_SECRET
```

Then compose the clients:

```ts
import { CdpX402Client } from "@coinbase/cdp-sdk/x402";
import { wrapFetchWithPayment } from "@x402/fetch";

const BASE = "eip155:8453";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const AGENTRESOLVER_BASE_PAYTO =
  "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8";

type GuardedCdpOptions = {
  maxTargetPriceUsd: number;
  accountName?: string;
  agentResolverOrigin?: string;
};

export function createGuardedCdpX402Fetch(options: GuardedCdpOptions) {
  const accountName = options.accountName ?? "agentresolver-guarded-agent";
  const origin =
    options.agentResolverOrigin ?? "https://agentresolver.vercel.app";

  // Client A: original merchant payments.
  // Keep caller-owned static controls here even though AgentResolver is also used.
  const targetClient = new CdpX402Client({
    walletConfig: {
      type: "eoa",
      accountName,
    },
    spendControls: {
      // Example ceiling: 0.05 USDC per target payment on Base.
      // Set this to the organization's own policy.
      maxAmountPerPayment: {
        atomic: 50_000n,
        asset: BASE_USDC,
      },
      allowedNetworks: [BASE],
      allowedAssets: [BASE_USDC],
    },
  });

  // Client B: pays AgentResolver Guard only.
  // No AgentResolver hook is installed on this client.
  const guardClient = new CdpX402Client({
    walletConfig: {
      type: "eoa",
      accountName,
    },
    spendControls: {
      // Canonical AgentResolver Guard fee is currently $0.001 USDC.
      maxAmountPerPayment: {
        atomic: 1_000n,
        asset: BASE_USDC,
      },
      allowedNetworks: [BASE],
      allowedAssets: [BASE_USDC],
      allowedPayees: [AGENTRESOLVER_BASE_PAYTO],
    },
  });

  const guardFetch = wrapFetchWithPayment(fetch, guardClient);

  targetClient.onBeforePaymentCreation(async context => {
    const paymentRequired = context.paymentRequired;
    const selected = context.selectedRequirements;
    const targetUrl = paymentRequired.resource?.url;

    if (!targetUrl || !targetUrl.startsWith("https://")) {
      return {
        abort: true,
        reason: "AgentResolver Guard requires a public HTTPS target resource",
      };
    }

    // AgentResolver's current prepayment decision supports exact USDC.
    // Fail closed instead of silently weakening the check for another scheme.
    if (selected.scheme !== "exact") {
      return {
        abort: true,
        reason:
          "AgentResolver Guard currently requires the x402 exact scheme for this integration",
      };
    }

    // The generic x402 core hook does not carry the original fetch RequestInit.
    // If Bazaar metadata explicitly declares a method, require GET here.
    // For a POST target use the explicit request-scoped flow described below.
    const advertisedMethod =
      (
        paymentRequired.extensions as
          | {
              bazaar?: {
                info?: {
                  input?: {
                    method?: unknown;
                  };
                };
              };
            }
          | undefined
      )?.bazaar?.info?.input?.method;

    if (
      advertisedMethod !== undefined &&
      String(advertisedMethod).toUpperCase() !== "GET"
    ) {
      return {
        abort: true,
        reason:
          "This CDP + AgentResolver native-hook adapter is GET-only; use the explicit POST Guard flow",
      };
    }

    const guardUrl = new URL("/api/payment-guard", origin);
    guardUrl.searchParams.set("url", targetUrl);
    guardUrl.searchParams.set("method", "GET");
    guardUrl.searchParams.set(
      "maxPriceUsd",
      String(options.maxTargetPriceUsd),
    );
    guardUrl.searchParams.set("expectedPayTo", selected.payTo);
    guardUrl.searchParams.set("expectedNetwork", selected.network);

    let guardResponse: Response;
    try {
      // Separate payment #1.
      // CDP's local Guard-client spend controls run before this wallet signs.
      guardResponse = await guardFetch(guardUrl.toString(), {
        method: "GET",
      });
    } catch (error) {
      return {
        abort: true,
        reason:
          error instanceof Error
            ? `AgentResolver Guard unavailable: ${error.message}`
            : "AgentResolver Guard unavailable",
      };
    }

    if (!guardResponse.ok) {
      return {
        abort: true,
        reason: `AgentResolver Guard returned HTTP ${guardResponse.status}`,
      };
    }

    const result = (await guardResponse.json().catch(() => null)) as
      | {
          prepaymentDecision?: {
            decision?: unknown;
            eligibleForCallerAuthorization?: unknown;
            targetPayment?: {
              network?: unknown;
              asset?: unknown;
              payTo?: unknown;
              resource?: unknown;
              amountAtomic?: unknown;
              scheme?: unknown;
              x402Version?: unknown;
            };
          };
        }
      | null;

    const decision = result?.prepaymentDecision;

    if (
      decision?.decision !== "eligible" ||
      decision?.eligibleForCallerAuthorization !== true
    ) {
      return {
        abort: true,
        reason: "AgentResolver Guard did not return an eligible decision",
      };
    }

    const observed = decision.targetPayment;

    const evmEqual = (left: unknown, right: unknown) =>
      typeof left === "string" &&
      typeof right === "string" &&
      left.toLowerCase() === right.toLowerCase();

    // Bind AgentResolver's observation back to the exact payment option
    // selected by the CDP x402 client. Any drift fails closed.
    if (
      observed?.network !== selected.network ||
      observed?.amountAtomic !== selected.amount ||
      observed?.scheme !== selected.scheme ||
      observed?.x402Version !== paymentRequired.x402Version ||
      observed?.resource !== targetUrl ||
      !evmEqual(observed?.asset, selected.asset) ||
      !evmEqual(observed?.payTo, selected.payTo)
    ) {
      return {
        abort: true,
        reason:
          "AgentResolver Guard evidence does not match the selected x402 payment requirements",
      };
    }

    // No objection from AgentResolver.
    //
    // This is NOT spending authorization. CDP's own spend controls and the
    // caller's policy still govern creation of the target payment payload.
    return undefined;
  });

  return wrapFetchWithPayment(fetch, targetClient);
}
```

Usage:

```ts
const guardedFetch = createGuardedCdpX402Fetch({
  maxTargetPriceUsd: 0.05,
});

const response = await guardedFetch(
  "https://merchant.example/paid-resource",
);
```

## The two payments stay independent

This flow can create two separate wallet decisions:

1. **AgentResolver Guard fee** — currently $0.001 USDC on the canonical Guard path.
2. **Merchant payment** — the exact target payment requirements that passed the live Guard check.

CDP spend controls apply locally. An AgentResolver `eligible` result does not override them and does not authorize the merchant payment.

The Guard client is intentionally restricted to:
- Base mainnet;
- Base USDC;
- AgentResolver's canonical Base `payTo`;
- at most 1,000 atomic USDC per Guard payment in this example.

The target client should use the organization's own caps and asset/network policy.

## Why the dynamic check is still useful with CDP spend controls

Static wallet controls can answer questions such as:

- Is this network allowed?
- Is this asset allowed?
- Is this amount under our cap?
- Is this payee on our allowlist?
- Have we exceeded a cumulative budget?

AgentResolver adds a point-in-time check of the live x402 contract:

- did the endpoint actually return a valid x402 challenge?
- is it x402 v2?
- is the selected scheme supported?
- does the live amount match policy?
- does the live `payTo` match the expected recipient?
- does the network/asset match?
- is the payment resource bound to the URL the caller intended to pay?

Those are complementary controls.

## POST targets

Do not generalize the GET-first hook above to arbitrary POST endpoints.

A generic pre-payment hook does not necessarily contain the exact request body or enough information to prove that an unpaid POST probe is side-effect safe.

For a POST resource:

1. retain the original request method and body in the caller runtime;
2. call AgentResolver Guard through the explicit request-scoped flow;
3. pass the exact method/body;
4. set `allowUnpaidPostProbe: true` only when the caller already knows that unpaid probe is side-effect safe;
5. require an eligible decision and exact evidence match;
6. then let CDP's own local policy independently decide whether to sign the target payment.

If those conditions cannot be satisfied, fail closed.

## Other payment schemes

The CDP SDK can support x402 schemes beyond `exact`, including `upto`, `auth-capture`, and `batch-settlement` depending on wallet/network configuration.

This AgentResolver integration deliberately does **not** claim to verify those schemes today. The current AgentResolver prepayment decision requires `scheme === "exact"`.

If the target client selects another scheme, abort rather than pretending the existing Guard check applies.

## Production contracts

- AgentResolver Guard: `https://agentresolver.vercel.app/api/payment-guard`
- Stable capability: `x402-payment-preflight`
- Buyer setup: `https://agentresolver.vercel.app/api/x402-client-setup`
- Trust contract: `https://agentresolver.vercel.app/.well-known/agentresolver-trust.json`
- Evidence contract: `https://agentresolver.vercel.app/.well-known/agentresolver-evidence.json`

For the framework-neutral version of the same pattern, see
[`x402-core-payment-guard.md`](./x402-core-payment-guard.md).
