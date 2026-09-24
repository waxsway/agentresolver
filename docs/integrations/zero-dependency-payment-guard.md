# Zero-dependency x402 Guard integration

Use this path when your wallet, proxy, or agent runtime already has an x402 payment-enabled `fetch` and you do not want to install the `agentresolver-client` package.

AgentResolver stays outside custody. Your runtime keeps the wallet, private key, merchant-payment authorization, and local budget policy.

## Where it belongs

Run Guard **after you observe a merchant 402 and before you create/sign the merchant payment**.

```text
merchant request
  -> merchant 402
  -> local amount / rate / recipient policy
  -> AgentResolver Guard
  -> compare returned live payment evidence to the merchant challenge
  -> caller decides whether to sign merchant payment
```

Guard costs $0.001 USDC when the check succeeds. It is usually most useful for unfamiliar merchants, changed payment terms, or transactions above a caller-defined threshold rather than as mandatory overhead on every tiny payment.

## Important: keep the Guard payment path separate

The `guardFetch` below must be an x402 payment-enabled fetch that is **not itself wrapped by your merchant Guard hook**. Otherwise paying the Guard fee can recursively invoke Guard.

It can use the same caller-owned wallet and spend policy; it just needs a hook-free payment path.

## Copy-paste helper

```ts
type GuardResult = {
  guard?: {
    decision?: "eligible" | "blocked";
    eligibleForCallerAuthorization?: boolean;
    reasonCodes?: string[];
    evidenceDigestSha256?: string;
    paymentIdentityFingerprint?: string;
    paymentTermsFingerprint?: string;
  };
  prepaymentDecision?: {
    decision?: "eligible" | "blocked";
    eligibleForCallerAuthorization?: boolean;
    reasons?: string[];
    targetPayment?: {
      network?: string | null;
      asset?: string | null;
      payTo?: string | null;
      resource?: string | null;
      amountAtomic?: string | null;
      amountUsd?: number | null;
      scheme?: string | null;
      x402Version?: number | null;
    };
  };
};

export async function assertAgentResolverGuard(options: {
  guardFetch: typeof fetch;
  targetUrl: string;
  method?: "GET" | "HEAD" | "POST";
  maxPriceUsd?: number;
  expectedPayTo?: string;
  expectedNetwork?: string;
}): Promise<GuardResult> {
  const endpoint = new URL(
    "https://agentresolver.vercel.app/api/payment-guard"
  );

  endpoint.searchParams.set("url", options.targetUrl);
  endpoint.searchParams.set("method", options.method ?? "GET");

  if (options.maxPriceUsd !== undefined) {
    endpoint.searchParams.set("maxPriceUsd", String(options.maxPriceUsd));
  }
  if (options.expectedPayTo) {
    endpoint.searchParams.set("expectedPayTo", options.expectedPayTo);
  }
  if (options.expectedNetwork) {
    endpoint.searchParams.set("expectedNetwork", options.expectedNetwork);
  }

  // guardFetch handles AgentResolver's own x402 challenge + retry.
  const response = await options.guardFetch(endpoint, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `AgentResolver Guard failed closed: HTTP ${response.status}`
    );
  }

  const result = (await response.json()) as GuardResult;
  const decision = result.prepaymentDecision ?? result.guard;

  if (
    decision?.decision !== "eligible" ||
    decision?.eligibleForCallerAuthorization !== true
  ) {
    const reasons =
      "reasons" in (decision ?? {})
        ? (decision as GuardResult["prepaymentDecision"])?.reasons
        : result.guard?.reasonCodes;

    throw new Error(
      `AgentResolver blocked target payment: ${(reasons ?? []).join(", ") || "unknown_reason"}`
    );
  }

  return result;
}
```

## Bind Guard back to the challenge you intend to pay

Do not treat an `eligible` result as blanket permission to spend.

Pass the merchant challenge values you already selected as caller assertions:

```ts
const evidence = await assertAgentResolverGuard({
  guardFetch,
  targetUrl: merchantUrl,
  method: "GET",
  maxPriceUsd: 0.05,
  expectedPayTo: selectedRequirement.payTo,
  expectedNetwork: selectedRequirement.network,
});

const target = evidence.prepaymentDecision?.targetPayment;

if (
  !target ||
  target.payTo?.toLowerCase() !== selectedRequirement.payTo.toLowerCase() ||
  target.network !== selectedRequirement.network ||
  target.asset?.toLowerCase() !== selectedRequirement.asset.toLowerCase()
) {
  throw new Error("Guard evidence no longer matches selected merchant terms");
}

// Only now continue into your own local authorization/signing path.
```

For production integrations, also bind the returned amount, resource, scheme, and x402 version to the exact requirement your wallet will sign. If anything changes, fail closed and run a fresh Guard.

## What Guard adds to local wallet policy

Local policy should still own:

- per-payment and cumulative spend caps
- velocity/rate limits
- user or agent authorization rules
- recipient allow/block lists
- wallet custody and signing

Guard adds live external evidence about:

- HTTPS/TLS and target reachability
- parseable x402 v2 challenge structure
- exact payment scheme
- quoted USDC amount
- Base or Solana asset/network consistency
- `payTo`
- target resource binding
- caller-supplied `expectedPayTo`, `expectedNetwork`, and `maxPriceUsd`
- stable payment-identity and payment-terms fingerprints for change detection

An `eligible` result means the observed technical payment terms passed the preflight. It does **not** establish provider legitimacy, guarantee fulfillment, or authorize the merchant spend.
