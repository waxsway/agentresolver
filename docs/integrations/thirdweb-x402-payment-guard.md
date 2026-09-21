# Thirdweb x402 + AgentResolver Guard

Use AgentResolver as a fail-closed pre-sign check in front of Thirdweb's public `wrapFetchWithPayment` client.

This integration does not require a Thirdweb SDK patch. It uses only the public `thirdweb/x402` export.

## What this adapter does

For a GET x402 resource:

1. make the merchant request once and retain the real `402 Payment Required`;
2. pay AgentResolver Guard through a **separate** Thirdweb payment wrapper;
3. require AgentResolver to return an eligible Base/USDC/`exact` decision;
4. bind that decision to the exact payment requirement from the retained merchant 402;
5. replay the retained 402 into Thirdweb's payment wrapper so the merchant is not probed again;
6. let Thirdweb create the payment header and perform the signed merchant retry.

The Guard fee and merchant payment remain separate wallet decisions.

AgentResolver never receives the wallet private key.

## Why the retained 402 matters

A loose integration could call AgentResolver and then let Thirdweb choose a different payment option from the merchant challenge.

This adapter does not do that.

AgentResolver's returned evidence is used by Thirdweb's public `paymentRequirementsSelector`, so Thirdweb may sign **only** the requirement whose:

- scheme;
- network;
- asset;
- amount;
- recipient; and
- resource

match the live Guard result.

If no exact match exists, Thirdweb gets no selectable payment requirement and fails closed.

## Base / USDC / exact / GET reference

```ts
import { wrapFetchWithPayment } from "thirdweb/x402";

const BASE = "eip155:8453";
const BASE_USDC =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const AGENTRESOLVER_BASE_PAYTO =
  "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8";

type ThirdwebClientArg = Parameters<typeof wrapFetchWithPayment>[1];
type ThirdwebWalletArg = Parameters<typeof wrapFetchWithPayment>[2];

type GuardOptions = {
  client: ThirdwebClientArg;
  wallet: ThirdwebWalletArg;

  // Keep both values under caller control.
  // They should express the same target-payment policy in different units.
  maxTargetPriceUsd: number;
  maxTargetValueAtomic: bigint;

  agentResolverOrigin?: string;
};

type GuardTargetPayment = {
  network?: unknown;
  asset?: unknown;
  payTo?: unknown;
  resource?: unknown;
  amountAtomic?: unknown;
  scheme?: unknown;
  x402Version?: unknown;
};

function absoluteHttpsUrl(input: RequestInfo | URL): string {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  const base =
    typeof globalThis.location !== "undefined"
      ? globalThis.location.href
      : undefined;

  const url = new URL(raw, base);

  if (url.protocol !== "https:") {
    throw new Error("AgentResolver Guard requires an HTTPS target");
  }

  if (url.username || url.password || url.hash) {
    throw new Error("Target URL contains unsupported credentials or fragment");
  }

  return url.toString();
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  const method =
    init?.method ??
    (typeof Request !== "undefined" && input instanceof Request
      ? input.method
      : "GET");

  return method.toUpperCase();
}

function sameEvmAddress(left: unknown, right: unknown): boolean {
  return (
    typeof left === "string" &&
    typeof right === "string" &&
    left.toLowerCase() === right.toLowerCase()
  );
}

function decodeBase64UrlUtf8(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function readPaymentRequired(response: Response) {
  const encoded = response.headers.get("payment-required");

  if (encoded) {
    return JSON.parse(decodeBase64UrlUtf8(encoded)) as Record<
      string,
      unknown
    >;
  }

  return (await response.clone().json()) as Record<string, unknown>;
}

function normalizedAmount(requirement: {
  maxAmountRequired?: unknown;
  amount?: unknown;
}): string | undefined {
  if (typeof requirement.maxAmountRequired === "string") {
    return BigInt(requirement.maxAmountRequired).toString();
  }

  if (typeof requirement.amount === "string") {
    return BigInt(requirement.amount).toString();
  }

  return undefined;
}

export function createAgentResolverThirdwebFetch(
  options: GuardOptions,
): typeof globalThis.fetch {
  const origin =
    options.agentResolverOrigin ?? "https://agentresolver.vercel.app";

  // This wrapper pays only AgentResolver Guard.
  // It is deliberately built on raw fetch, not on the guarded merchant fetch,
  // so the Guard's own 402 cannot recurse back into AgentResolver.
  const guardPayFetch = wrapFetchWithPayment(
    globalThis.fetch,
    options.client,
    options.wallet,
    {
      maxValue: 1_000n,
      paymentRequirementsSelector(requirements) {
        return requirements.find(requirement => {
          return (
            requirement.scheme === "exact" &&
            requirement.network === BASE &&
            sameEvmAddress(requirement.asset, BASE_USDC) &&
            sameEvmAddress(
              requirement.payTo,
              AGENTRESOLVER_BASE_PAYTO,
            ) &&
            normalizedAmount(requirement) === "1000"
          );
        });
      },
    },
  );

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const targetUrl = absoluteHttpsUrl(input);
    const method = requestMethod(input, init);

    // A generic unpaid POST probe can have side effects.
    // Use an explicit request-scoped integration for POST.
    if (method !== "GET") {
      throw new Error(
        "This Thirdweb + AgentResolver adapter is GET-only; use the explicit Guard flow for non-GET targets",
      );
    }

    // Merchant request #1: obtain the exact challenge Thirdweb would pay.
    const initialResponse = await globalThis.fetch(input, init);

    if (initialResponse.status !== 402) {
      return initialResponse;
    }

    const initialPaymentRequired =
      await readPaymentRequired(initialResponse);

    if (initialPaymentRequired.x402Version !== 2) {
      throw new Error(
        "AgentResolver Thirdweb adapter requires x402 v2",
      );
    }

    const resource = initialPaymentRequired.resource;
    if (
      typeof resource !== "object" ||
      resource === null ||
      Array.isArray(resource) ||
      (resource as { url?: unknown }).url !== targetUrl
    ) {
      throw new Error(
        "Merchant x402 resource is not bound to the requested URL",
      );
    }

    // Separate payment #1: AgentResolver Guard.
    const guardUrl = new URL("/api/payment-guard", origin);
    guardUrl.searchParams.set("url", targetUrl);
    guardUrl.searchParams.set("method", "GET");
    guardUrl.searchParams.set(
      "maxPriceUsd",
      String(options.maxTargetPriceUsd),
    );
    guardUrl.searchParams.set("expectedNetwork", BASE);

    const guardResponse = await guardPayFetch(guardUrl.toString(), {
      method: "GET",
    });

    if (!guardResponse.ok) {
      throw new Error(
        `AgentResolver Guard returned HTTP ${guardResponse.status}`,
      );
    }

    const guardResult = (await guardResponse.json().catch(() => null)) as
      | {
          prepaymentDecision?: {
            decision?: unknown;
            eligibleForCallerAuthorization?: unknown;
            targetPayment?: GuardTargetPayment;
          };
        }
      | null;

    const decision = guardResult?.prepaymentDecision;
    const observed = decision?.targetPayment;

    if (
      decision?.decision !== "eligible" ||
      decision?.eligibleForCallerAuthorization !== true ||
      !observed
    ) {
      throw new Error(
        "AgentResolver Guard did not return an eligible decision",
      );
    }

    if (
      observed.scheme !== "exact" ||
      observed.network !== BASE ||
      observed.resource !== targetUrl ||
      observed.x402Version !== initialPaymentRequired.x402Version ||
      !sameEvmAddress(observed.asset, BASE_USDC)
    ) {
      throw new Error(
        "AgentResolver Guard returned unsupported or mismatched target evidence",
      );
    }

    // Thirdweb will normally make its own first request before paying.
    // Feed it the already-captured 402 exactly once instead, then use raw
    // fetch for the signed retry.
    let replayedInitial = false;

    const retainedChallengeFetch: typeof globalThis.fetch = async (
      nextInput,
      nextInit,
    ) => {
      const nextUrl = absoluteHttpsUrl(nextInput);

      if (!replayedInitial) {
        if (nextUrl !== targetUrl) {
          throw new Error(
            "Thirdweb attempted to pay a different target URL",
          );
        }

        replayedInitial = true;
        return initialResponse.clone();
      }

      return globalThis.fetch(nextInput, nextInit);
    };

    const merchantPayFetch = wrapFetchWithPayment(
      retainedChallengeFetch,
      options.client,
      options.wallet,
      {
        maxValue: options.maxTargetValueAtomic,

        // This is the key evidence-binding boundary.
        paymentRequirementsSelector(requirements) {
          return requirements.find(requirement => {
            return (
              requirement.scheme === observed.scheme &&
              requirement.network === observed.network &&
              sameEvmAddress(requirement.asset, observed.asset) &&
              sameEvmAddress(requirement.payTo, observed.payTo) &&
              normalizedAmount(requirement) ===
                observed.amountAtomic &&
              requirement.resource === observed.resource
            );
          });
        },
      },
    );

    // Separate payment #2: the merchant payment.
    // Thirdweb will abort if the exact Guard-approved requirement is absent
    // or if it exceeds maxTargetValueAtomic.
    return merchantPayFetch(input, init);
  };
}
```

## Example use

```ts
import { createThirdwebClient } from "thirdweb";
import { createWallet } from "thirdweb/wallets";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

const wallet = createWallet("io.metamask");
await wallet.connect({ client });

const guardedFetch = createAgentResolverThirdwebFetch({
  client,
  wallet,
  maxTargetPriceUsd: 0.05,
  maxTargetValueAtomic: 50_000n,
});

const response = await guardedFetch(
  "https://merchant.example/paid-resource",
);
```

The same pattern can be used with other Thirdweb wallet implementations. The caller still owns wallet connection, signing, chain switching, and any additional authorization UX.

## Failure behavior

The adapter fails closed when:

- the target is not HTTPS;
- the target is not GET;
- the initial merchant response is not a valid x402 v2 resource-bound 402;
- the Guard payment cannot be made within its own 1,000-atomic-USDC cap;
- the Guard does not return `eligible`;
- the Guard observes a non-Base, non-USDC, non-`exact` target;
- the merchant challenge changed so Thirdweb cannot find the exact Guard-approved requirement;
- Thirdweb's own `maxValue` policy rejects the merchant payment;
- the wallet cannot sign or complete the retry.

## Why there are two Thirdweb payment wrappers

The Guard is itself an x402-paid service.

If the Guard payment were routed through the merchant Guard adapter, its own 402 would recursively trigger another Guard payment.

The dedicated `guardPayFetch` uses raw fetch and a strict selector that can choose only AgentResolver's canonical $0.001 Base-USDC Guard requirement.

The merchant wrapper is created only after Guard evidence exists and can select only the matching merchant requirement.

## POST and side-effecting APIs

Do not adapt this GET pattern by simply changing `method` to POST.

For POST targets, retain the exact request body and use the explicit AgentResolver request-scoped Guard flow. Only allow an unpaid POST probe when the caller already knows the endpoint is side-effect safe and explicitly opts in.

## Contracts

- Guard: `https://agentresolver.vercel.app/api/payment-guard`
- Buyer setup: `https://agentresolver.vercel.app/api/x402-client-setup`
- Trust: `https://agentresolver.vercel.app/.well-known/agentresolver-trust.json`
- Evidence: `https://agentresolver.vercel.app/.well-known/agentresolver-evidence.json`

For the official x402 core integration, see
[`x402-core-payment-guard.md`](./x402-core-payment-guard.md).

For Coinbase CDP-managed wallets, see
[`coinbase-cdp-sdk-payment-guard.md`](./coinbase-cdp-sdk-payment-guard.md).
