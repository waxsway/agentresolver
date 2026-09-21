# Native x402 client payment guard

AgentResolver can run as a repeat-use pre-sign safety gate for the official x402 TypeScript client.

This integration uses the stable `x402Client.onBeforePaymentCreation` lifecycle hook. It does **not** depend on Coinbase AgentKit's proposed `beforePayment` hook.

## Why two x402 clients are required

The target-payment client has the AgentResolver hook installed.

The Guard-payment client does **not**.

If the same hooked client is used to pay AgentResolver Guard, the Guard payment would trigger the same hook recursively. Keep the two roles separate even if both clients use the same caller-controlled signer.

```text
target 402
  -> target client onBeforePaymentCreation
  -> dedicated Guard client pays AgentResolver Guard
  -> Guard inspects the live target 402
  -> eligible? caller policy may continue : abort
  -> target client creates the target payment payload
```

AgentResolver never receives the caller's private key and never authorizes the target spend.

## GET-first TypeScript adapter

Install the official x402 client packages as normal:

```bash
npm install @x402/fetch @x402/evm
```

Create two clients. Register the same caller-owned signer on each if the caller intends to use the same wallet for both payments.

```ts
import {
  wrapFetchWithPayment,
  x402Client,
} from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

type AgentResolverGuardOptions = {
  maxTargetPriceUsd: number;
  agentResolverOrigin?: string;
};

export function createGuardedX402Fetch(
  signer: ConstructorParameters<typeof ExactEvmScheme>[0],
  options: AgentResolverGuardOptions,
) {
  const origin =
    options.agentResolverOrigin ?? "https://agentresolver.vercel.app";

  // Client A signs the original merchant payment.
  const targetClient = new x402Client();
  targetClient.register("eip155:*", new ExactEvmScheme(signer));

  // Client B is intentionally hook-free. It is used only to pay AgentResolver.
  const guardClient = new x402Client();
  guardClient.register("eip155:*", new ExactEvmScheme(signer));
  const guardFetch = wrapFetchWithPayment(fetch, guardClient);

  targetClient.onBeforePaymentCreation(async (context) => {
    const paymentRequired = context.paymentRequired;
    const selected = context.selectedRequirements;
    const targetUrl = paymentRequired.resource?.url;

    if (!targetUrl || !targetUrl.startsWith("https://")) {
      return {
        abort: true,
        reason: "AgentResolver Guard requires a public HTTPS target resource",
      };
    }

    // This adapter is deliberately GET-first. For POST resources, use a
    // request-scoped integration that can pass the exact method/body safely.
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
          "This AgentResolver native hook adapter is GET-only; use the explicit POST Guard flow",
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
      // Separate payment #1: the caller-owned wallet pays the $0.001 Guard fee.
      // The hook-free guardClient prevents recursion.
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
    const evmEqual = (a: unknown, b: unknown) =>
      typeof a === "string" &&
      typeof b === "string" &&
      a.toLowerCase() === b.toLowerCase();

    // Bind Guard evidence back to the exact option the x402 client selected.
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

    // Returning void does not authorize the target spend. It only lets the
    // x402 client continue to its normal caller-owned signing policy.
  });

  return wrapFetchWithPayment(fetch, targetClient);
}
```

Use the returned fetch only for GET-first target resources:

```ts
const guardedFetch = createGuardedX402Fetch(signer, {
  maxTargetPriceUsd: 0.05,
});

const response = await guardedFetch(
  "https://merchant.example/paid-resource",
);
```

## Keep native spend controls too

AgentResolver Guard is dynamic payment-contract verification. It should complement, not replace, the official x402 client's local `spendControls`.

Keep static controls such as:
- maximum payment size;
- permitted assets;
- permitted networks;
- any organization-specific wallet policy.

The Guard adds a fresh live check of the target's x402 challenge, including scheme, network, asset, amount, `payTo`, and resource binding.

## Two independent authorizations

There are two separate payments:

1. **AgentResolver Guard fee** — currently $0.001 USDC on the canonical Guard path.
2. **Original target payment** — whatever the target's verified challenge requires.

An `eligible` Guard result is evidence only. It never authorizes payment #2.

The host should ensure its own wallet/spending policy permits each payment independently.

## Fail closed

Abort before target signing if:
- AgentResolver cannot be reached;
- the Guard payment is not authorized by caller policy;
- Guard does not return a successful paid response;
- Guard returns `blocked`;
- the response is malformed;
- the returned target terms do not exactly match the x402 client's selected requirements;
- the target is not a GET resource for this adapter.

For POST targets, use the explicit Guard flow and pass the exact method/body. Never perform an unpaid POST probe unless the caller knows that probe is side-effect safe and explicitly opts in.

## Stable contracts

- Guard: `https://agentresolver.vercel.app/api/payment-guard`
- Underlying capability: `x402-payment-preflight`
- Buyer setup: `https://agentresolver.vercel.app/api/x402-client-setup`
- Trust contract: `https://agentresolver.vercel.app/.well-known/agentresolver-trust.json`

The official x402 lifecycle hook used here is `x402Client.onBeforePaymentCreation`. The selected payment requirements are available on `context.selectedRequirements`, and returning `{ abort: true, reason }` cancels payment payload creation before signing.
