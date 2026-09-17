"use client";

import { useState } from "react";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<any>;
};

type QuoteResponse = {
  ok: boolean;
  error?: string;
  paymentRequired?: any;
  selected?: any;
};

const BASE_CHAIN_HEX = "0x2105";

function getEthereum(): EthereumProvider | undefined {
  return (window as Window & { ethereum?: EthereumProvider }).ethereum;
}

function randomNonce(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return ("0x" +
    Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")) as `0x${string}`;
}

function toBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        jsonSafe(item),
      ])
    );
  }
  return value;
}

async function ensureBase(provider: EthereumProvider) {
  const current = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
  if (current === BASE_CHAIN_HEX) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_HEX }],
    });
  } catch (error: any) {
    if (error?.code !== 4902) throw error;

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: BASE_CHAIN_HEX,
          chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://mainnet.base.org"],
          blockExplorerUrls: ["https://basescan.org"],
        },
      ],
    });
  }
}

export default function NoHumansPayPage() {
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function pay() {
    setBusy(true);
    setResult(null);

    try {
      const provider = getEthereum();
      if (!provider) {
        throw new Error(
          "MetaMask was not detected. Open this page inside the MetaMask mobile browser or a desktop browser with the MetaMask extension."
        );
      }

      setStatus("Connecting MetaMask…");
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const address = String(accounts?.[0] ?? "");
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        throw new Error("MetaMask did not return a valid EVM address.");
      }

      setStatus("Switching to Base…");
      await ensureBase(provider);

      setStatus("Checking the live NoHumans $3 quote…");
      const quoteResponse = await fetch("/api/nohumans-single-quote", {
        method: "POST",
        cache: "no-store",
      });
      const quote = (await quoteResponse.json()) as QuoteResponse;
      if (!quoteResponse.ok || !quote.ok || !quote.paymentRequired || !quote.selected) {
        throw new Error(quote.error || "The live NoHumans quote did not match the authorized $3 terms.");
      }

      const selected = quote.selected;
      const now = Math.floor(Date.now() / 1000);
      const authorization = {
        from: address,
        to: selected.payTo,
        value: String(selected.amount),
        validAfter: "0",
        validBefore: String(now + Math.min(Number(selected.maxTimeoutSeconds ?? 60), 55)),
        nonce: randomNonce(),
      };

      const typedData = jsonSafe({
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        primaryType: "TransferWithAuthorization",
        domain: {
          name: selected.extra?.name ?? "USD Coin",
          version: selected.extra?.version ?? "2",
          chainId: 8453,
          verifyingContract: selected.asset,
        },
        message: authorization,
      });

      setStatus("Approve the 3 USDC authorization in MetaMask…");
      const signature = await provider.request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(typedData)],
      });

      const paymentPayload = {
        x402Version: 2,
        resource: quote.paymentRequired.resource,
        accepted: selected,
        payload: {
          signature,
          authorization,
        },
        extensions: quote.paymentRequired.extensions ?? {},
      };

      const paymentSignature = toBase64Utf8(JSON.stringify(paymentPayload));

      setStatus("Submitting the signed x402 payment to NoHumans…");
      const paidResponse = await fetch("/api/nohumans-single-pay", {
        method: "POST",
        headers: {
          "payment-signature": paymentSignature,
        },
      });
      const paid = await paidResponse.json();

      setResult(paid);

      if (!paidResponse.ok || !paid.ok) {
        throw new Error(
          paid?.result?.error ||
            paid?.result?.errorReason ||
            paid?.error ||
            `NoHumans returned HTTP ${paidResponse.status}.`
        );
      }

      setStatus("Paid. NoHumans verification purchase queued.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        maxWidth: 720,
        margin: "0 auto",
        padding: "64px 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p style={{ opacity: 0.7, marginBottom: 8 }}>AgentResolver</p>
      <h1 style={{ fontSize: 40, lineHeight: 1.05, margin: "0 0 16px" }}>
        Buy NoHumans verification
      </h1>
      <p style={{ fontSize: 18, lineHeight: 1.6 }}>
        Authorize exactly <strong>3 USDC on Base</strong>. NoHumans promises one
        real purchase of the AgentResolver settlement canary within 24 hours.
        The private listing-owner token stays on the AgentResolver server.
      </p>

      <div
        style={{
          margin: "28px 0",
          padding: 20,
          border: "1px solid currentColor",
          borderRadius: 16,
        }}
      >
        <div><strong>Amount:</strong> 3.000000 USDC</div>
        <div><strong>Network:</strong> Base</div>
        <div><strong>Plan:</strong> NoHumans single verification</div>
        <div><strong>AgentResolver endpoint:</strong> /api/x402-ping</div>
      </div>

      <button
        onClick={pay}
        disabled={busy}
        style={{
          width: "100%",
          padding: "16px 20px",
          borderRadius: 12,
          border: 0,
          fontSize: 18,
          fontWeight: 700,
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Working…" : "Pay 3 USDC with MetaMask"}
      </button>

      <p style={{ marginTop: 20, lineHeight: 1.5 }}>
        <strong>Status:</strong> {status}
      </p>

      {result ? (
        <pre
          style={{
            marginTop: 20,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            padding: 16,
            borderRadius: 12,
            background: "rgba(127,127,127,.12)",
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}

      <p style={{ marginTop: 32, fontSize: 14, opacity: 0.7, lineHeight: 1.5 }}>
        This uses EIP-3009 authorization. MetaMask signs the payment
        authorization; your private key never leaves the wallet. AgentResolver
        refuses to forward any signed payload whose network, token, amount, or
        recipient differs from the authorized NoHumans quote.
      </p>
    </main>
  );
}
