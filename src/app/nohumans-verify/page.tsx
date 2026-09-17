"use client";

import { useCallback, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  type Account,
  type WalletClient,
} from "viem";
import { base } from "viem/chains";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequired } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner, type ClientEvmSigner } from "@x402/evm";

import {
  assertNoHumansSingleInvoice,
  BASE_USDC,
  NOHUMANS_PAY_TO,
  NOHUMANS_SINGLE_AMOUNT,
} from "@/lib/nohumansVerification";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

const ERC20_BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

function injectedProvider(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum;
}

function decodePaymentRequired(value: string): PaymentRequired {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const parsed = JSON.parse(atob(padded)) as unknown;
  assertNoHumansSingleInvoice(parsed);
  return parsed;
}

function walletToSigner(
  walletClient: WalletClient,
  publicClient: { readContract: (args: never) => Promise<unknown> },
): ClientEvmSigner {
  if (!walletClient.account) {
    throw new Error("MetaMask account is unavailable");
  }

  return toClientEvmSigner(
    {
      address: walletClient.account.address,
      signTypedData: async message =>
        walletClient.signTypedData({
          account: walletClient.account as Account,
          domain: message.domain,
          types: message.types,
          primaryType: message.primaryType,
          message: message.message,
        }),
    },
    {
      readContract: args => publicClient.readContract(args as never),
    },
  );
}

async function ensureBase(provider: EthereumProvider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x2105" }],
    });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? Number((error as { code?: unknown }).code)
        : undefined;

    if (code !== 4902) throw error;

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x2105",
          chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://mainnet.base.org"],
          blockExplorerUrls: ["https://basescan.org"],
        },
      ],
    });
  }
}

function requireQueuedOutcome(parsed: Record<string, unknown>) {
  const status = parsed.status;
  const feeTx = parsed.fee_tx;
  const requestId = parsed.request_id;

  if (
    status !== "queued" ||
    typeof feeTx !== "string" ||
    !feeTx ||
    typeof requestId !== "string" ||
    !requestId
  ) {
    throw new Error(
      "NoHumans returned success without a queued request, fee_tx, and request_id. No additional payment attempt will be made from this page.",
    );
  }
}

export default function NoHumansVerificationCheckout() {
  const [status, setStatus] = useState("Ready to validate the wallet and authorize the $3 verification purchase.");
  const [busy, setBusy] = useState(false);
  const [signedOnce, setSignedOnce] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const pay = useCallback(async () => {
    if (signedOnce) {
      setStatus("A signed attempt has already been submitted from this page. Reload before any retry.");
      return;
    }

    setBusy(true);
    setResult(null);

    try {
      const provider = injectedProvider();
      if (!provider) {
        throw new Error("MetaMask was not detected. Open this page inside the MetaMask browser.");
      }

      setStatus("Connecting MetaMask…");
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const selected = accounts[0] as `0x${string}` | undefined;
      if (!selected) throw new Error("No MetaMask account was selected");
      setAddress(selected);

      setStatus("Switching to Base…");
      await ensureBase(provider);

      const walletClient = createWalletClient({
        account: selected,
        chain: base,
        transport: custom(provider as never),
      });
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      setStatus("Checking Base USDC balance…");
      const usdcBalance = await publicClient.readContract({
        address: BASE_USDC as `0x${string}`,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: "balanceOf",
        args: [selected],
      });
      const readableBalance = formatUnits(usdcBalance, 6);
      setBalance(readableBalance);

      if (usdcBalance < BigInt(NOHUMANS_SINGLE_AMOUNT)) {
        throw new Error(
          `Selected wallet has ${readableBalance} USDC on Base. The verified NoHumans invoice requires 3.00 USDC, so signing is blocked.`,
        );
      }

      setStatus("Verifying NoHumans invoice terms…");
      const challengeResponse = await fetch("/api/nohumans-verification-pay", {
        method: "POST",
        cache: "no-store",
      });
      if (challengeResponse.status !== 402) {
        throw new Error(`Expected x402 challenge, got HTTP ${challengeResponse.status}`);
      }

      const encoded = challengeResponse.headers.get("payment-required");
      if (!encoded) throw new Error("NoHumans did not return PAYMENT-REQUIRED");
      const paymentRequired = decodePaymentRequired(encoded);

      const client = new x402Client();
      client.setSpendControls({ maxAmountPerPayment: "$3" });
      client.register(
        "eip155:*",
        new ExactEvmScheme(
          walletToSigner(
            walletClient,
            publicClient as unknown as { readContract: (args: never) => Promise<unknown> },
          ),
        ),
      );

      setStatus("MetaMask will ask you to authorize exactly 3 USDC…");
      const payload = await client.createPaymentPayload(paymentRequired);
      setSignedOnce(true);
      const httpClient = new x402HTTPClient(client);
      const paymentHeaders = httpClient.encodePaymentSignatureHeader(payload);

      setStatus("Submitting the single signed x402 payment to NoHumans…");
      const paidResponse = await fetch("/api/nohumans-verification-pay", {
        method: "POST",
        cache: "no-store",
        headers: paymentHeaders,
      });

      const attemptId = paidResponse.headers.get("x-agentresolver-verification-attempt");
      const raw = await paidResponse.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        parsed = { raw };
      }

      if (!paidResponse.ok) {
        const upstreamMessage =
          typeof parsed.message === "string"
            ? parsed.message
            : typeof parsed.error === "string"
              ? parsed.error
              : `NoHumans returned HTTP ${paidResponse.status}`;
        throw new Error(
          `${attemptId ? `${upstreamMessage} [attempt ${attemptId}]` : upstreamMessage} Reload before any retry.`,
        );
      }

      requireQueuedOutcome(parsed);
      setResult(attemptId ? { ...parsed, agentresolver_attempt_id: attemptId } : parsed);
      setStatus("Payment accepted. NoHumans returned a queued verification request with settlement evidence.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }, [signedOnce]);

  const metamaskUrl =
    "https://metamask.app.link/dapp/agentresolver.vercel.app/nohumans-verify";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0d10",
        color: "#f5f7fa",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "32px 20px",
      }}
    >
      <section style={{ maxWidth: 620, margin: "0 auto" }}>
        <p style={{ opacity: 0.65, marginBottom: 8 }}>AgentResolver operator action</p>
        <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>Queue NoHumans paid verification</h1>
        <p style={{ lineHeight: 1.6, opacity: 0.85 }}>
          This validates the selected wallet first, then signs one x402 authorization for exactly <strong>$3.00 USDC</strong> on Base.
          No private key leaves MetaMask. The authorization is bound to the NoHumans payment address and amount below.
        </p>

        <div
          style={{
            border: "1px solid #2b3038",
            borderRadius: 14,
            padding: 18,
            margin: "24px 0",
            background: "#12161c",
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          <div><strong>Amount:</strong> 3.00 USDC ({NOHUMANS_SINGLE_AMOUNT} atomic)</div>
          <div><strong>Network:</strong> Base (8453)</div>
          <div style={{ overflowWrap: "anywhere" }}><strong>USDC:</strong> {BASE_USDC}</div>
          <div style={{ overflowWrap: "anywhere" }}><strong>Pay to:</strong> {NOHUMANS_PAY_TO}</div>
          <div><strong>Purpose:</strong> one independent purchase of AgentResolver within 24 hours</div>
          {address ? <div style={{ marginTop: 8 }}><strong>Paying from:</strong> {address}</div> : null}
          {balance ? <div><strong>Base USDC balance:</strong> {balance}</div> : null}
        </div>

        <button
          type="button"
          disabled={busy || signedOnce}
          onClick={pay}
          style={{
            width: "100%",
            border: 0,
            borderRadius: 12,
            padding: "15px 18px",
            fontSize: 17,
            fontWeight: 700,
            cursor: busy || signedOnce ? "not-allowed" : "pointer",
            opacity: busy || signedOnce ? 0.6 : 1,
          }}
        >
          {busy ? "Processing…" : signedOnce ? "Reload before retry" : "Validate wallet and pay $3 USDC"}
        </button>

        {!injectedProvider() ? (
          <a
            href={metamaskUrl}
            style={{
              display: "block",
              marginTop: 12,
              textAlign: "center",
              color: "#c8d7ff",
              padding: 12,
            }}
          >
            Open this checkout in MetaMask
          </a>
        ) : null}

        <div
          style={{
            marginTop: 20,
            borderRadius: 10,
            padding: 14,
            background: "#171b22",
            overflowWrap: "anywhere",
          }}
        >
          {status}
        </div>

        {result ? (
          <pre
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 10,
              overflowX: "auto",
              background: "#101318",
              fontSize: 12,
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
      </section>
    </main>
  );
}
