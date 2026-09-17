"use client";

import { useState } from "react";
import { x402Client } from "@x402/core/client";
import { x402HTTPClient } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createWalletClient, custom, type Hex } from "viem";
import { base } from "viem/chains";

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
    };
  }
}

const EXPECTED_NETWORK = "eip155:8453";
const EXPECTED_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const EXPECTED_AMOUNT = 3_000_000n;
const PROXY_URL = "/api/nohumans-verify-now";

type Status = {
  kind: "idle" | "working" | "success" | "error";
  message: string;
  tx?: string;
};

function amountOf(option: Record<string, unknown>) {
  const raw = option.amount ?? option.maxAmountRequired;
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw new Error("NoHumans returned no payable amount.");
  }
  return BigInt(raw);
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export default function NoHumansVerificationCheckout() {
  const [status, setStatus] = useState<Status>({
    kind: "idle",
    message: "Ready to connect MetaMask.",
  });

  async function pay() {
    try {
      setStatus({ kind: "working", message: "Connecting MetaMask…" });

      if (!window.ethereum) {
        throw new Error(
          "MetaMask was not detected. Open this page inside the MetaMask browser.",
        );
      }

      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const address = accounts?.[0] as Hex | undefined;
      if (!address) throw new Error("No MetaMask account was selected.");

      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      } catch (error: unknown) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? Number((error as { code?: unknown }).code)
            : null;

        if (code !== 4902) throw error;

        await window.ethereum.request({
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

      const walletClient = createWalletClient({
        account: address,
        chain: base,
        transport: custom(window.ethereum),
      });

      const signer = {
        address,
        signTypedData: (args: {
          domain?: Record<string, unknown>;
          types: Record<string, Array<{ name: string; type: string }>>;
          primaryType: string;
          message: Record<string, unknown>;
        }) =>
          walletClient.signTypedData({
            account: address,
            domain: args.domain,
            types: args.types,
            primaryType: args.primaryType,
            message: args.message,
          } as Parameters<typeof walletClient.signTypedData>[0]),
      };

      const core = new x402Client().register(
        EXPECTED_NETWORK,
        new ExactEvmScheme(signer),
      );
      const http = new x402HTTPClient(core);

      setStatus({ kind: "working", message: "Loading the $3 NoHumans invoice…" });

      const challenge = await fetch(PROXY_URL, {
        method: "POST",
        cache: "no-store",
      });

      if (challenge.status !== 402) {
        const body = await readBody(challenge);
        if (challenge.ok) {
          setStatus({
            kind: "success",
            message: "NoHumans says this verification plan is already active.",
          });
          return;
        }
        throw new Error(
          `Expected a $3 x402 invoice; received HTTP ${challenge.status}: ${JSON.stringify(body)}`,
        );
      }

      const challengeBody = await challenge.clone().json().catch(() => undefined);
      const paymentRequired = http.getPaymentRequiredResponse(
        (name) => challenge.headers.get(name),
        challengeBody,
      );

      const option = paymentRequired.accepts.find(
        (candidate) =>
          candidate.scheme === "exact" &&
          candidate.network === EXPECTED_NETWORK &&
          candidate.asset.toLowerCase() === EXPECTED_ASSET.toLowerCase(),
      );

      if (!option) {
        throw new Error("NoHumans did not return the expected Base USDC payment option.");
      }

      if (amountOf(option as unknown as Record<string, unknown>) !== EXPECTED_AMOUNT) {
        throw new Error("Refusing payment: NoHumans invoice is not exactly $3.00 USDC.");
      }

      setStatus({
        kind: "working",
        message: "Approve the $3.00 USDC typed-data signature in MetaMask…",
      });

      const payload = await http.createPaymentPayload(paymentRequired);
      const paymentHeaders = http.encodePaymentSignatureHeader(payload);

      setStatus({
        kind: "working",
        message: "Signature approved. Settling $3.00 USDC on Base…",
      });

      const paid = await fetch(PROXY_URL, {
        method: "POST",
        headers: paymentHeaders,
        cache: "no-store",
      });

      const body = await readBody(paid);

      if (!paid.ok) {
        throw new Error(
          `NoHumans payment failed with HTTP ${paid.status}: ${JSON.stringify(body)}`,
        );
      }

      let tx: string | undefined;
      if (paid.headers.has("payment-response")) {
        const settlement = http.getPaymentSettleResponse((name) =>
          paid.headers.get(name),
        );
        tx = settlement.transaction || undefined;
      }

      setStatus({
        kind: "success",
        message:
          "Paid. NoHumans single verification is purchased; their real purchase is due within 24 hours.",
        tx,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const busy = status.kind === "working";

  return (
    <main>
      <div className="eyebrow">NOHUMANS PAID VERIFICATION</div>
      <h1>Buy AgentResolver&apos;s first independent verification.</h1>
      <p className="lead">
        One $3.00 USDC payment on Base purchases NoHumans&apos; single plan:
        one real purchase of AgentResolver&apos;s $0.001 settlement canary
        within 24 hours. The AgentResolver owner token stays server-side.
      </p>

      <section>
        <h2>Payment guardrails</h2>
        <p>
          This checkout refuses to sign unless the invoice is x402 exact,
          Base mainnet, native Base USDC, and exactly 3.000000 USDC.
        </p>
        <p>
          MetaMask signs the USDC authorization. AgentResolver never receives
          your private key.
        </p>
      </section>

      <p className="actions">
        <button className="button" onClick={pay} disabled={busy || status.kind === "success"}>
          {busy ? "Working…" : status.kind === "success" ? "Purchased" : "Pay $3 USDC with MetaMask"}
        </button>
        <a className="button secondary" href="https://nohumans.directory/l/28e33786-f07">
          View NoHumans listing
        </a>
      </p>

      <pre><code>{status.message}{status.tx ? `\nTransaction: ${status.tx}` : ""}</code></pre>

      <p className="links">
        <a href="/">AgentResolver</a> ·{" "}
        <a href="/.well-known/agentresolver-reputation.json">Settlement history</a>
      </p>
    </main>
  );
}
