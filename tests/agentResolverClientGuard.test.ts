import assert from "node:assert/strict";
import test from "node:test";
import {
  createAgentResolverX402GuardHook,
  type X402BeforePaymentContext
} from "../packages/agentresolver-client/src/index";

const context: X402BeforePaymentContext = {
  paymentRequired: {
    x402Version: 2,
    resource: { url: "https://merchant.example/paid" }
  },
  selectedRequirements: {
    scheme: "exact",
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amount: "5000",
    payTo: "0x1111111111111111111111111111111111111111"
  }
};

function eligibleGuardResponse(
  overrides: Record<string, unknown> = {}
): Response {
  return new Response(
    JSON.stringify({
      prepaymentDecision: {
        decision: "eligible",
        eligibleForCallerAuthorization: true,
        targetPayment: {
          network: context.selectedRequirements.network,
          asset: context.selectedRequirements.asset.toLowerCase(),
          payTo: context.selectedRequirements.payTo.toUpperCase(),
          resource: context.paymentRequired.resource?.url,
          amountAtomic: context.selectedRequirements.amount,
          scheme: context.selectedRequirements.scheme,
          x402Version: context.paymentRequired.x402Version,
          ...overrides
        }
      }
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" }
    }
  );
}

test("embedded Guard hook binds evidence to the exact selected x402 payment", async () => {
  const calls: string[] = [];
  const hook = createAgentResolverX402GuardHook({
    maxTargetPriceUsd: 0.05,
    guardFetch: async input => {
      calls.push(String(input));
      return eligibleGuardResponse();
    }
  });

  const result = await hook(context);
  assert.equal(result, undefined);
  assert.equal(calls.length, 1);

  const guardUrl = new URL(calls[0]!);
  assert.equal(guardUrl.pathname, "/api/payment-guard");
  assert.equal(
    guardUrl.searchParams.get("url"),
    "https://merchant.example/paid"
  );
  assert.equal(guardUrl.searchParams.get("method"), "GET");
  assert.equal(guardUrl.searchParams.get("maxPriceUsd"), "0.05");
  assert.equal(
    guardUrl.searchParams.get("expectedPayTo"),
    context.selectedRequirements.payTo
  );
  assert.equal(
    guardUrl.searchParams.get("expectedNetwork"),
    context.selectedRequirements.network
  );
});

test("embedded Guard hook fails closed when Guard evidence changes", async () => {
  const hook = createAgentResolverX402GuardHook({
    maxTargetPriceUsd: 0.05,
    guardFetch: async () => eligibleGuardResponse({ amountAtomic: "5001" })
  });

  assert.deepEqual(await hook(context), {
    abort: true,
    reason:
      "AgentResolver Guard evidence does not match the selected x402 payment requirements"
  });
});

test("embedded Guard hook refuses non-GET targets before paying Guard", async () => {
  let called = false;
  const hook = createAgentResolverX402GuardHook({
    maxTargetPriceUsd: 0.05,
    guardFetch: async () => {
      called = true;
      return eligibleGuardResponse();
    }
  });

  const result = await hook({
    ...context,
    paymentRequired: {
      ...context.paymentRequired,
      extensions: {
        bazaar: {
          info: {
            input: {
              method: "POST"
            }
          }
        }
      }
    }
  });

  assert.equal(called, false);
  assert.deepEqual(result, {
    abort: true,
    reason:
      "AgentResolver embedded Guard hook is GET-only; use the explicit request-scoped Guard flow for non-GET targets"
  });
});

test("embedded Guard hook fails closed when AgentResolver is unavailable", async () => {
  const hook = createAgentResolverX402GuardHook({
    maxTargetPriceUsd: 0.05,
    guardFetch: async () => {
      throw new Error("network down");
    }
  });

  assert.deepEqual(await hook(context), {
    abort: true,
    reason: "AgentResolver Guard unavailable: network down"
  });
});

test("embedded Guard hook rejects invalid max target price configuration", () => {
  assert.throws(
    () =>
      createAgentResolverX402GuardHook({
        maxTargetPriceUsd: Number.NaN,
        guardFetch: fetch
      }),
    /maxTargetPriceUsd/
  );
});
