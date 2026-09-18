import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/x402-ping/route";
import { x402RuntimeDiscoveryOutput } from "../src/lib/x402RuntimeDiscovery";

test("x402-ping PAYMENT-REQUIRED stays within an interoperability-friendly header budget", async () => {
  const response = await GET(new NextRequest("https://agentresolver.vercel.app/api/x402-ping", {
    method: "GET",
    headers: { "user-agent": "agentresolver-test" }
  }));

  assert.equal(response.status, 402);
  const paymentRequired = response.headers.get("payment-required");
  assert.ok(paymentRequired);
  assert.ok(
    Buffer.byteLength(paymentRequired, "utf8") < 8192,
    `PAYMENT-REQUIRED is ${Buffer.byteLength(paymentRequired, "utf8")} bytes`
  );

  const decoded = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8")) as any;
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.extensions?.bazaar?.info?.output?.example?.pong, true);
  assert.equal(decoded.extensions?.bazaar?.info?.output?.example?.settledDelivery, true);
  assert.equal(decoded.extensions?.bazaar?.info?.output?.example?.next, undefined);
  assert.equal(decoded.extensions?.agentresolver?.info?.version, 1);
  assert.equal(
    decoded.extensions?.agentresolver?.info?.setup,
    "https://agentresolver.vercel.app/api/x402-client-setup?source=x402-challenge&capabilityId=x402-ping"
  );
  assert.equal(
    decoded.extensions?.agentresolver?.info?.paymentGuard,
    "https://agentresolver.vercel.app/api/payment-guard"
  );
  assert.equal(decoded.extensions?.agentresolver?.info?.retryHeader, "PAYMENT-SIGNATURE");
  assert.equal(decoded.extensions?.agentresolver?.info?.signerControlledByCaller, true);
  assert.equal(decoded.extensions?.agentresolver?.info?.spendAuthorizationRequired, true);
  assert.equal(decoded.extensions?.agentresolver?.schema?.type, "object");
  assert.ok(decoded.extensions?.agentresolver?.schema?.required?.includes("clients"));
  assert.equal(
    decoded.extensions?.agentresolver?.info?.clients?.httpTs?.schemes?.[0]?.[1],
    "@x402/evm/exact/client"
  );
  assert.equal(
    decoded.extensions?.agentresolver?.info?.clients?.python?.install,
    'pip install "x402[httpx,evm]"'
  );
  assert.equal(
    decoded.extensions?.agentresolver?.info?.clients?.python?.exactEvmRegistrationImport,
    "from x402.mechanisms.evm.exact.register import register_exact_evm_client"
  );
  assert.equal(decoded.extensions?.agentresolver?.info?.clients?.walletMcp?.command, "x402-trinity-mcp");
  assert.equal(decoded.extensions?.agentresolver?.info?.clients?.managedWalletMcp?.command, "x402-wallet-mcp");
  assert.deepEqual(
    decoded.extensions?.agentresolver?.info?.clients?.managedWalletMcp?.tools,
    ["query_endpoint", "call_endpoint", "configure_spending", "manage_allowlist", "check_balance"]
  );
  assert.doesNotMatch(
    JSON.stringify(decoded.extensions?.agentresolver),
    /PRIVATE_KEY|seed phrase|0xYourPrivateKey/i
  );
});

test("runtime discovery keeps preflight decision metadata compact", () => {
  const output = x402RuntimeDiscoveryOutput("x402-payment-preflight") as {
    example: {
      prepaymentDecision: {
        decision: string;
        eligibleForCallerAuthorization: boolean;
      };
    };
  };
  assert.equal(output.example.prepaymentDecision.decision, "eligible");
  assert.equal(output.example.prepaymentDecision.eligibleForCallerAuthorization, true);
  assert.ok(JSON.stringify(output).length < 1200);
});
