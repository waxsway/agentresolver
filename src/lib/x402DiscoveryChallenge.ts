import { NextResponse } from "next/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import { X402_PREFLIGHT_OUTPUT_EXAMPLE, X402_PREFLIGHT_OUTPUT_SCHEMA } from "@/lib/x402PreflightDiscovery";
import { X402_PING_OUTPUT_EXAMPLE, X402_PING_OUTPUT_SCHEMA } from "@/lib/x402PingDiscovery";
import { x402WireResourceMetadata } from "@/lib/x402WireResourceMetadata";
import { X402_NETWORK, X402_PAY_TO, X402_SOLANA_ASSET, X402_SOLANA_FEE_PAYER, X402_SOLANA_NETWORK, X402_SOLANA_PAY_TO } from "@/lib/x402Config";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export type DiscoveryCapability = PaidCapabilityId;
export type X402DiscoveryChallengeOptions = Readonly<{ endpoint?: string }>;

export function x402DiscoveryChallenge(
  capabilityId: DiscoveryCapability,
  options: X402DiscoveryChallengeOptions = {}
) {
  const config = getPaidCapability(capabilityId);
  const endpoint = options.endpoint?.trim() || config.endpoint;
  if (!endpoint.startsWith("/api/")) {
    throw new Error("Discovery endpoint override must start with /api/.");
  }
  const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
  const solanaPayTo = (process.env.AGENTRESOLVER_SOLANA_PAY_TO || X402_SOLANA_PAY_TO).trim();
  const resourceUrl = `https://agentresolver.vercel.app${endpoint}`;
  const wireMetadata = x402WireResourceMetadata(config);
  const discoveryOutput = capabilityId === "x402-payment-preflight"
    ? {
        example: X402_PREFLIGHT_OUTPUT_EXAMPLE,
        schema: X402_PREFLIGHT_OUTPUT_SCHEMA
      }
    : capabilityId === "x402-ping"
      ? {
          example: X402_PING_OUTPUT_EXAMPLE,
          schema: X402_PING_OUTPUT_SCHEMA
        }
      : {
          example: {},
          schema: {
            type: "object",
            additionalProperties: true
          }
        };
  const body = {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: resourceUrl,
      description: wireMetadata.description,
      mimeType: "application/json",
      serviceName: wireMetadata.serviceName,
      tags: wireMetadata.tags
    },
    accepts: [
      {
        scheme: "exact",
        network: X402_NETWORK,
        amount: config.atomicAmount,
        asset: BASE_USDC,
        payTo,
        maxTimeoutSeconds: 60,
        extra: { name: "USD Coin", version: "2" }
      },
      {
        scheme: "exact",
        network: X402_SOLANA_NETWORK,
        amount: config.atomicAmount,
        asset: X402_SOLANA_ASSET,
        payTo: solanaPayTo,
        maxTimeoutSeconds: 60,
        extra: { feePayer: X402_SOLANA_FEE_PAYER }
      }
    ],
    extensions: {
      ...declareDiscoveryExtension({
        input: config.example,
        inputSchema: config.inputSchema,
        bodyType: "json",
        output: discoveryOutput
      }),
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
      "access-control-expose-headers": "payment-required, link",
      "payment-required": encoded
    }
  });
}
