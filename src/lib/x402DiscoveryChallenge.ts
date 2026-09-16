import { NextResponse } from "next/server";
import { getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import { X402_NETWORK, X402_PAY_TO, X402_SOLANA_ASSET, X402_SOLANA_FEE_PAYER, X402_SOLANA_NETWORK, X402_SOLANA_PAY_TO } from "@/lib/x402Config";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export type DiscoveryCapability = PaidCapabilityId;

export function x402DiscoveryChallenge(capabilityId: DiscoveryCapability) {
  const config = getPaidCapability(capabilityId);
  const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
  const solanaPayTo = (process.env.AGENTRESOLVER_SOLANA_PAY_TO || X402_SOLANA_PAY_TO).trim();
  const resourceUrl = `https://agentresolver.vercel.app${config.endpoint}`;
  const body = {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: resourceUrl,
      description: config.description,
      mimeType: "application/json",
      serviceName: "AgentResolver",
      tags: ["agents", "x402", ...config.tags]
    },
    accepts: [
      {
        scheme: "exact",
        network: X402_NETWORK,
        amount: config.atomicAmount,
        maxAmountRequired: config.atomicAmount,
        asset: BASE_USDC,
        payTo,
        resource: resourceUrl,
        maxTimeoutSeconds: 60,
        extra: { name: "USD Coin", version: "2" }
      },
      {
        scheme: "exact",
        network: X402_SOLANA_NETWORK,
        amount: config.atomicAmount,
        maxAmountRequired: config.atomicAmount,
        asset: X402_SOLANA_ASSET,
        payTo: solanaPayTo,
        resource: resourceUrl,
        maxTimeoutSeconds: 60,
        extra: { feePayer: X402_SOLANA_FEE_PAYER }
      }
    ],
    extensions: {
      agentresolver: {
        capabilityId: config.id,
        priceUsd: config.priceUsd,
        costClass: config.costClass
      }
    }
  };

  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString("base64");
  return NextResponse.json(body, {
    status: 402,
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "payment-required",
      "payment-required": encoded
    }
  });
}
